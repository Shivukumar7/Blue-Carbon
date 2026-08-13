import { Router } from 'express';
import crypto from 'node:crypto';
import { one, many, tx } from '../db.js';
import { wrap } from '../lib/auth.js';
import { buildCertificate } from '../lib/certificate.js';

const router = Router();

/**
 * Registry commercial terms. The platform fee funds verification and registry
 * operations; GST applies to that service fee, not to the credits themselves.
 */
export const PRICING = {
  currency: 'INR',
  platformFeeRate: 0.04,
  taxRate: 0.18,
  minTonnes: 1,
  /** Credits are issued and retired in whole tonnes, so serials stay exact. */
  increment: 1,
};

const PAYMENT_METHODS = {
  card: { label: 'Card', prefix: 'CARD' },
  upi: { label: 'UPI', prefix: 'UPI' },
  netbanking: { label: 'Net banking', prefix: 'NB' },
};

const round2 = (n) => Math.round(n * 100) / 100;

/** Authoritative price breakdown for a given volume. */
function quoteFor(pricePerTonne, tonnes) {
  const subtotal = round2(pricePerTonne * tonnes);
  const fee = round2(subtotal * PRICING.platformFeeRate);
  const tax = round2(fee * PRICING.taxRate);
  return { subtotal, fee, tax, total: round2(subtotal + fee + tax) };
}

router.get('/pricing', (req, res) => res.json({ pricing: PRICING }));

/** Headline numbers for the public landing page. No authentication needed. */
router.get('/impact', wrap(async (req, res) => {
  const stats = await one(`
    SELECT
      (SELECT COUNT(*)::int FROM projects) AS projects,
      (SELECT COALESCE(SUM(area_hectares),0) FROM projects) AS hectares,
      (SELECT COUNT(*)::int FROM users WHERE role IN ('member','leader')) AS people,
      (SELECT COUNT(*)::int FROM communities) AS communities,
      (SELECT COALESCE(SUM(saplings_planted),0)::int FROM daily_entries) AS saplings,
      (SELECT COALESCE(SUM(tonnes),0) FROM orders WHERE status = 'paid') AS tonnes_retired
  `);

  const projects = await many(`
    SELECT p.code, p.name, p.ecosystem, p.area_hectares, c.district, c.state,
           p.boundary, p.start_date::text AS start_date
      FROM projects p JOIN communities c ON c.id = p.community_id
     ORDER BY p.created_at DESC LIMIT 12`);

  res.json({ stats, projects });
}));

router.get('/listings', wrap(async (req, res) => {
  const listings = await many(`
    SELECT l.id, l.tonnes_available, l.tonnes_sold, l.price_per_tonne, l.vintage_year, l.status,
           (l.tonnes_available - l.tonnes_sold) AS tonnes_remaining,
           p.code AS project_code, p.name AS project_name, p.ecosystem,
           p.area_hectares, p.start_date::text AS start_date, p.boundary,
           c.name AS community_name, c.district, c.state,
           (SELECT COUNT(*)::int FROM chunks WHERE project_id = p.id) AS parcels,
           (SELECT COALESCE(AVG(participation_rate),0) FROM credits
             WHERE project_id = p.id AND role = 'leader') AS participation
      FROM listings l
      JOIN projects p ON p.id = l.project_id
      JOIN communities c ON c.id = p.community_id
     WHERE l.status = 'open'
     ORDER BY l.created_at DESC`);
  res.json({ listings, pricing: PRICING });
}));

/**
 * Buyer checkout and registry transfer. No account required — buyers identify
 * themselves on the form.
 *
 * The response carries a `settlement` trail describing what actually happened,
 * in the order it happened, so the client can walk the buyer through it:
 *   authorise payment -> capture -> reserve credits -> assign serial numbers
 *   -> transfer to the buyer -> retire (cancel) -> issue certificate.
 *
 * Payment authorisation is simulated. Replace `authorisePayment` with a
 * Razorpay/Stripe capture call; everything downstream of it is real.
 */
router.post('/orders', wrap(async (req, res) => {
  const {
    listingId, tonnes, buyerName, buyerEmail, buyerOrg, buyerPhone, buyerCountry,
    beneficiary, paymentMethod = 'card', card, upiId, bank,
  } = req.body;

  if (!buyerName?.trim()) return res.status(400).json({ error: 'Enter the buyer name' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail || '')) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }

  const qty = Number(tonnes);
  if (!Number.isInteger(qty) || qty < PRICING.minTonnes) {
    return res.status(400).json({
      error: `Credits are issued in whole tonnes — enter ${PRICING.minTonnes} or more`,
    });
  }

  const method = PAYMENT_METHODS[paymentMethod];
  if (!method) return res.status(400).json({ error: 'Choose a payment method' });

  if (paymentMethod === 'card') {
    const digits = String(card?.number || '').replace(/\D/g, '');
    if (digits.length < 12 || digits.length > 19) {
      return res.status(400).json({ error: 'Enter a valid card number' });
    }
    if (!/^\d{2}\s?\/\s?\d{2}$/.test(card?.expiry || '')) {
      return res.status(400).json({ error: 'Card expiry must look like 09/28' });
    }
    if (!/^\d{3,4}$/.test(card?.cvc || '')) {
      return res.status(400).json({ error: 'Enter the security code on the back of your card' });
    }
  }
  if (paymentMethod === 'upi' && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId || '')) {
    return res.status(400).json({ error: 'Enter a UPI ID such as name@bank' });
  }
  if (paymentMethod === 'netbanking' && !bank) {
    return res.status(400).json({ error: 'Choose your bank' });
  }

  const settlement = [];
  const step = (id, label, detail) =>
    settlement.push({ id, label, detail, at: new Date().toISOString() });

  const result = await tx(async (client) => {
    const { rows: listingRows } = await client.query(
      `SELECT l.*, p.code AS project_code
         FROM listings l JOIN projects p ON p.id = l.project_id
        WHERE l.id = $1 AND l.status = 'open' FOR UPDATE`,
      [listingId]
    );
    const listing = listingRows[0];
    if (!listing) {
      throw Object.assign(new Error('That listing is no longer available'), { status: 404 });
    }

    const soldBefore = Number(listing.tonnes_sold);
    const remaining = Number(listing.tonnes_available) - soldBefore;
    if (qty > remaining) {
      throw Object.assign(
        new Error(`Only ${Math.floor(remaining)} tCO2e remain in this lot`), { status: 400 }
      );
    }

    const quote = quoteFor(Number(listing.price_per_tonne), qty);

    // 1-2. Payment authorisation and capture.
    const paymentReference = `${method.prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    step('authorise', 'Payment authorised', `${method.label} · ${paymentReference}`);
    const amount = quote.total.toLocaleString('en-IN', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    });
    step('capture', 'Funds captured', `₹${amount} including fees and GST`);

    // 3. Reserve the volume against the lot so no one else can take it.
    const soldAfter = soldBefore + qty;
    await client.query(
      `UPDATE listings SET tonnes_sold = $1,
              status = CASE WHEN $1 >= tonnes_available THEN 'sold_out' ELSE status END
        WHERE id = $2`,
      [soldAfter, listing.id]
    );
    step('reserve', 'Credits reserved', `${qty} tCO2e held against lot ${listing.project_code}`);

    // 4. Assign the serial block. Serials are 1-based within the project.
    const serialStart = Math.floor(soldBefore) + 1;
    const serialEnd = serialStart + qty - 1;
    step(
      'serials',
      'Serial numbers assigned',
      `${listing.project_code}-${String(serialStart).padStart(6, '0')} to ${String(serialEnd).padStart(6, '0')}`
    );

    const reference = `BCR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const holder = beneficiary?.trim() || buyerOrg?.trim() || buyerName.trim();

    const { rows } = await client.query(
      `INSERT INTO orders (reference, listing_id, buyer_name, buyer_email, buyer_org,
                           buyer_phone, buyer_country, tonnes, total_amount, status,
                           payment_method, payment_reference, subtotal, fee_amount, tax_amount,
                           serial_start, serial_end, beneficiary, retired_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'paid',$10,$11,$12,$13,$14,$15,$16,$17,now())
       RETURNING *`,
      [reference, listing.id, buyerName.trim(), buyerEmail.trim(), buyerOrg?.trim() || null,
        buyerPhone?.trim() || null, buyerCountry?.trim() || null, qty, quote.total,
        paymentMethod, paymentReference, quote.subtotal, quote.fee, quote.tax,
        serialStart, serialEnd, holder]
    );

    // 5-7. Transfer into the buyer's holding, retire it, issue the certificate.
    step('transfer', 'Transferred to buyer', `Held for ${holder}`);
    step('retire', 'Credits retired', 'Permanently cancelled — cannot be resold or double-counted');
    step('certificate', 'Certificate issued', reference);

    return { order: rows[0], quote };
  });

  const detail = await one(
    `SELECT p.code AS project_code, p.name AS project_name, p.ecosystem,
            c.name AS community_name, c.district, c.state, l.vintage_year, l.price_per_tonne
       FROM listings l JOIN projects p ON p.id = l.project_id
       JOIN communities c ON c.id = p.community_id WHERE l.id = $1`,
    [result.order.listing_id]
  );

  res.status(201).json({ order: { ...result.order, ...detail }, settlement });
}));

const CERTIFICATE_QUERY = `
  SELECT o.*, p.code AS project_code, p.name AS project_name, p.ecosystem,
         c.name AS community_name, c.district, c.state, l.vintage_year, l.price_per_tonne
    FROM orders o JOIN listings l ON l.id = o.listing_id
    JOIN projects p ON p.id = l.project_id
    JOIN communities c ON c.id = p.community_id
   WHERE o.reference = $1`;

/** The certificate as a downloadable PDF. Public — the reference is the key. */
router.get('/orders/:reference/certificate.pdf', wrap(async (req, res) => {
  const order = await one(CERTIFICATE_QUERY, [req.params.reference]);
  if (!order) return res.status(404).json({ error: 'Certificate not found' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="blue-carbon-certificate-${order.reference}.pdf"`
  );

  const base = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  const doc = buildCertificate(order, { verifyUrl: `${base}/api/market/orders/${order.reference}` });
  doc.on('error', () => res.destroy());
  doc.pipe(res);
}));

/** Public certificate lookup — anyone holding the reference can verify it. */
router.get('/orders/:reference', wrap(async (req, res) => {
  const order = await one(
    `SELECT o.*, p.code AS project_code, p.name AS project_name, p.ecosystem,
            c.name AS community_name, c.district, c.state, l.vintage_year, l.price_per_tonne
       FROM orders o JOIN listings l ON l.id = o.listing_id
       JOIN projects p ON p.id = l.project_id
       JOIN communities c ON c.id = p.community_id
      WHERE o.reference = $1`,
    [req.params.reference]
  );
  if (!order) return res.status(404).json({ error: 'Certificate not found' });
  res.json({ order });
}));

export default router;
