import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote, Building2, Check, CheckCircle2, Copy, CreditCard, Download, Landmark, Loader2,
  Lock, Minus, Plus, ShieldCheck, Smartphone, X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { money, num } from '../lib/format.js';

const STEPS = ['Volume', 'Buyer', 'Payment'];

const METHODS = [
  { id: 'card', label: 'Card', icon: CreditCard, hint: 'Credit or debit' },
  { id: 'upi', label: 'UPI', icon: Smartphone, hint: 'Any UPI app' },
  { id: 'netbanking', label: 'Net banking', icon: Landmark, hint: 'Direct from your bank' },
];

const BANKS = ['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Punjab National Bank', 'Kotak Mahindra Bank'];

const DEFAULT_PRICING = { platformFeeRate: 0.04, taxRate: 0.18, minTonnes: 1 };

const round2 = (n) => Math.round(n * 100) / 100;
const formatCardNumber = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const serial = (code, n) => `${code}-${String(n).padStart(6, '0')}`;

function CopyButton({ value, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }).catch(() => {});
      }}
      className="cursor-pointer rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-abyss-900"
      aria-label={`${label}: ${value}`}
    >
      {done ? <Check size={13} className="text-tide-600" /> : <Copy size={13} />}
    </button>
  );
}

/** Read-only price breakdown, shown on every step so the total never surprises. */
function Breakdown({ quote, tonnes, price }) {
  return (
    <dl className="overflow-hidden rounded-xl border border-tide-100">
      {[
        [`Credits · ${num(tonnes)} tCO₂e × ${money(price)}`, money(quote.subtotal)],
        ['Registry & verification fee (4%)', money(quote.fee)],
        ['GST on fee (18%)', money(quote.tax)],
      ].map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4 bg-white px-4 py-2.5">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="tabular text-xs font-medium text-abyss-900">{value}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between gap-4 bg-sand px-4 py-3">
        <dt className="text-xs font-semibold text-abyss-900">Amount payable</dt>
        <dd className="tabular text-lg font-semibold text-abyss-900">{money(quote.total)}</dd>
      </div>
    </dl>
  );
}

/** Walks the buyer through the registry transfer as each step is confirmed. */
function Settlement({ steps, revealed }) {
  return (
    <ol className="space-y-1">
      {steps.map((s, i) => {
        const state = i < revealed ? 'done' : i === revealed ? 'active' : 'waiting';
        return (
          <li
            key={s.id}
            className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition duration-300
              ${state === 'waiting' ? 'opacity-35' : 'opacity-100'}
              ${state === 'active' ? 'bg-tide-50' : ''}`}
          >
            <span
              className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full
                ${state === 'done' ? 'bg-tide-600 text-white' : 'bg-slate-200 text-slate-500'}`}
            >
              {state === 'done' ? <Check size={12} strokeWidth={3} />
                : state === 'active' ? <Loader2 size={11} className="animate-spin" />
                : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-abyss-900">{s.label}</p>
              <p className="truncate text-[11px] text-slate-500">{s.detail}</p>
            </div>
            {state === 'done' && (
              <time className="tabular shrink-0 text-[10px] text-slate-400">
                {new Date(s.at).toLocaleTimeString('en-IN', { hour12: false })}
              </time>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Buyer checkout. Deliberately account-free: buyers identify themselves on the
 * form, pay, watch the registry transfer settle, and receive a retirement
 * certificate carrying its own serial-number block.
 */
export default function CheckoutDialog({ listing, pricing = DEFAULT_PRICING, onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState('form'); // form | settling | done
  const [tonnes, setTonnes] = useState(10);
  const [buyer, setBuyer] = useState({
    buyerName: '', buyerEmail: '', buyerOrg: '', buyerPhone: '', buyerCountry: 'India', beneficiary: '',
  });
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvc: '' });
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState(BANKS[0]);
  const [settlement, setSettlement] = useState([]);
  const [revealed, setRevealed] = useState(0);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);

  const remaining = Math.floor(Number(listing?.tonnes_remaining ?? 0));
  const price = Number(listing?.price_per_tonne ?? 0);

  const quote = useMemo(() => {
    const qty = Math.max(0, Number(tonnes) || 0);
    const subtotal = round2(price * qty);
    const fee = round2(subtotal * pricing.platformFeeRate);
    const tax = round2(fee * pricing.taxRate);
    return { subtotal, fee, tax, total: round2(subtotal + fee + tax) };
  }, [tonnes, price, pricing]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && stage !== 'settling' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, stage]);

  // Reveal the settlement trail one confirmed step at a time.
  useEffect(() => {
    if (stage !== 'settling' || !settlement.length) return undefined;
    if (revealed >= settlement.length) {
      const t = setTimeout(() => setStage('done'), 650);
      return () => clearTimeout(t);
    }
    const quick = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setRevealed((r) => r + 1), quick ? 60 : 480);
    return () => clearTimeout(t);
  }, [stage, settlement, revealed]);

  function next() {
    setError('');
    if (step === 0) {
      const qty = Number(tonnes);
      if (!Number.isInteger(qty) || qty < pricing.minTonnes) {
        return setError(`Credits are issued in whole tonnes — enter ${pricing.minTonnes} or more.`);
      }
      if (qty > remaining) return setError(`Only ${num(remaining)} tCO₂e are left in this lot.`);
    }
    if (step === 1) {
      if (!buyer.buyerName.trim()) return setError('Please enter the buyer name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyer.buyerEmail)) {
        return setError('Please enter a valid email address — the certificate is sent here.');
      }
    }
    return setStep((s) => s + 1);
  }

  async function pay(e) {
    e.preventDefault();
    setError('');
    setStage('settling');
    setRevealed(0);
    try {
      const res = await api.post('/market/orders', {
        listingId: listing.id,
        tonnes: Number(tonnes),
        ...buyer,
        paymentMethod,
        card: paymentMethod === 'card' ? card : undefined,
        upiId: paymentMethod === 'upi' ? upiId : undefined,
        bank: paymentMethod === 'netbanking' ? bank : undefined,
      });
      setReceipt(res.order);
      setSettlement(res.settlement ?? []);
      onComplete?.();
    } catch (err) {
      setError(err.message);
      setStage('form');
    }
  }

  const busy = stage === 'settling';

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-abyss-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Buy and retire blue carbon credits"
      onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="animate-rise max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl outline-none"
      >
        {/* ------------------------------------------------------------ head */}
        <div className="flex items-start justify-between gap-4 border-b border-tide-100 px-6 py-5">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-widest text-tide-700">
              {listing.project_code}
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold text-abyss-900">
              {stage === 'done' ? 'Retirement certificate'
                : stage === 'settling' ? 'Settling your transfer'
                : listing.project_name}
            </h2>
            <p className="truncate text-xs text-slate-500">
              {listing.community_name} · {listing.district}, {listing.state}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100
                       hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        {/* ------------------------------------------------------ settling */}
        {stage === 'settling' && (
          <div className="px-6 py-6">
            <p className="mb-4 text-xs leading-relaxed text-slate-500">
              Do not close this window. Each step below is confirmed by the registry before the
              next one begins.
            </p>
            <Settlement steps={settlement} revealed={revealed} />
            {!settlement.length && (
              <div className="flex items-center gap-2.5 rounded-xl bg-sand px-4 py-3.5 text-sm text-slate-600">
                <Loader2 size={15} className="animate-spin text-tide-600" aria-hidden />
                Contacting your bank…
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------ receipt */}
        {stage === 'done' && receipt && (
          <div className="px-6 py-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-tide-100 text-tide-700">
                <CheckCircle2 size={22} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-abyss-900">
                  {num(receipt.tonnes)} tCO₂e retired and permanently cancelled
                </p>
                <p className="truncate text-xs text-slate-500">
                  Confirmation sent to {receipt.buyer_email}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-tide-100">
              <div className="flex items-center justify-between gap-3 border-b border-tide-100 bg-sand px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Certificate reference</p>
                  <p className="truncate font-mono text-sm font-semibold text-abyss-900">
                    {receipt.reference}
                  </p>
                </div>
                <CopyButton value={receipt.reference} label="Copy reference" />
              </div>

              <dl className="divide-y divide-tide-100">
                {[
                  ['Serial numbers',
                    receipt.serial_start
                      ? `${serial(receipt.project_code, receipt.serial_start)} – ${String(receipt.serial_end).padStart(6, '0')}`
                      : '—',
                    true],
                  ['Project', `${receipt.project_code} · ${receipt.project_name}`],
                  ['Community', `${receipt.community_name}, ${receipt.district}`],
                  ['Vintage', receipt.vintage_year],
                  ['Retired on behalf of', receipt.beneficiary || receipt.buyer_name],
                  ['Retirement date', new Date(receipt.retired_at || receipt.created_at).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })],
                  ['Payment', `${receipt.payment_method?.toUpperCase() ?? '—'} · ${receipt.payment_reference ?? '—'}`, true],
                  ['Amount paid', money(receipt.total_amount)],
                ].map(([label, value, mono]) => (
                  <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
                    <dd className={`text-right text-xs font-medium text-abyss-900 ${mono ? 'font-mono' : ''}`}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-xl bg-tide-50 px-4 py-3 text-[11px] leading-relaxed text-tide-900">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
              These serials are cancelled in the registry and cannot be resold or claimed again.
              Anyone can verify this certificate from its reference.
            </p>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Proceeds net of the registry fee go to {receipt.community_name}, split across the
              daily stewardship credits each household earned.
            </p>

            <div className="mt-5 flex gap-2">
              <a
                href={`/api/market/orders/${receipt.reference}/certificate.pdf`}
                download={`blue-carbon-certificate-${receipt.reference}.pdf`}
                className="btn-primary flex-1"
              >
                <Download size={15} aria-hidden />
                Download certificate
              </a>
              <button type="button" onClick={onClose} className="btn-light">
                Done
              </button>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------- form */}
        {stage === 'form' && (
          <>
            <ol className="flex items-center gap-2 border-b border-tide-100 px-6 py-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-2">
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold
                      ${i <= step ? 'bg-tide-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span className={`text-[11px] font-medium ${i <= step ? 'text-abyss-900' : 'text-slate-400'}`}>
                    {s}
                  </span>
                  {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
                </li>
              ))}
            </ol>

            <form
              onSubmit={step === 2 ? pay : (e) => { e.preventDefault(); next(); }}
              className="px-6 py-5"
            >
              {/* ------------------------------------------------ volume */}
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-abyss-900">
                      Tonnes of CO₂e to retire
                    </span>
                    <div className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => setTonnes((v) => Math.max(pricing.minTonnes, Number(v) - 1))}
                        className="btn-light !px-3"
                        aria-label="Decrease by one tonne"
                      >
                        <Minus size={15} />
                      </button>
                      <input
                        type="number"
                        min={pricing.minTonnes}
                        max={remaining}
                        step="1"
                        value={tonnes}
                        onChange={(e) => setTonnes(e.target.value)}
                        className="field-light tabular flex-1 text-center text-base font-semibold"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setTonnes((v) => Math.min(remaining, Number(v) + 1))}
                        className="btn-light !px-3"
                        aria-label="Increase by one tonne"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                    <span className="mt-1.5 block text-[11px] text-slate-500">
                      {num(remaining)} tCO₂e available · issued in whole tonnes so every credit
                      carries its own serial number
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[5, 10, 25, 50].filter((v) => v <= remaining).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setTonnes(v)}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition
                          ${Number(tonnes) === v
                            ? 'border-tide-600 bg-tide-50 text-tide-800'
                            : 'border-slate-200 text-slate-600 hover:border-tide-400'}`}
                      >
                        {v} t
                      </button>
                    ))}
                  </div>

                  <Breakdown quote={quote} tonnes={tonnes} price={price} />

                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <ShieldCheck size={13} className="text-tide-600" aria-hidden />
                    Vintage {listing.vintage_year} · {listing.parcels} monitored parcels ·
                    government-surveyed boundary
                  </p>
                </div>
              )}

              {/* ------------------------------------------------- buyer */}
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['buyerName', 'Full name', 'text', true, 'sm:col-span-2', 'name'],
                    ['buyerEmail', 'Email', 'email', true, 'sm:col-span-2', 'email'],
                    ['buyerOrg', 'Organisation', 'text', false, 'sm:col-span-2', 'organization'],
                    ['buyerPhone', 'Phone', 'tel', false, '', 'tel'],
                    ['buyerCountry', 'Country', 'text', false, '', 'country-name'],
                  ].map(([key, label, type, required, span, ac]) => (
                    <label key={key} className={`block ${span}`}>
                      <span className="mb-1.5 block text-xs font-semibold text-abyss-900">
                        {label} {required && <span className="text-tide-600">*</span>}
                      </span>
                      <input
                        type={type}
                        autoComplete={ac}
                        value={buyer[key]}
                        required={required}
                        onChange={(e) => setBuyer({ ...buyer, [key]: e.target.value })}
                        className="field-light"
                      />
                    </label>
                  ))}

                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-abyss-900">
                      <Building2 size={13} className="text-tide-600" aria-hidden />
                      Retire on behalf of
                    </span>
                    <input
                      value={buyer.beneficiary}
                      onChange={(e) => setBuyer({ ...buyer, beneficiary: e.target.value })}
                      placeholder={buyer.buyerOrg || buyer.buyerName || 'Your organisation'}
                      className="field-light"
                    />
                    <span className="mt-1 block text-[11px] text-slate-500">
                      The name printed on the certificate. Leave blank to use your own.
                    </span>
                  </label>

                  <p className="text-[11px] leading-relaxed text-slate-500 sm:col-span-2">
                    These details are used only to issue your certificate and the matching
                    registry entry.
                  </p>
                </div>
              )}

              {/* ----------------------------------------------- payment */}
              {step === 2 && (
                <div className="space-y-4">
                  <Breakdown quote={quote} tonnes={tonnes} price={price} />

                  <div>
                    <span className="mb-2 block text-xs font-semibold text-abyss-900">Payment method</span>
                    <div className="grid grid-cols-3 gap-2">
                      {METHODS.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id)}
                          aria-pressed={paymentMethod === m.id}
                          className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border px-2 py-3
                            text-center transition duration-200
                            ${paymentMethod === m.id
                              ? 'border-tide-600 bg-tide-50 text-abyss-900'
                              : 'border-slate-200 text-slate-500 hover:border-tide-300'}`}
                        >
                          <m.icon size={17} className={paymentMethod === m.id ? 'text-tide-700' : ''} aria-hidden />
                          <span className="text-xs font-semibold">{m.label}</span>
                          <span className="text-[10px] leading-tight text-slate-400">{m.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentMethod === 'card' && (
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-abyss-900">Card number</span>
                        <div className="relative">
                          <CreditCard
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            aria-hidden
                          />
                          <input
                            inputMode="numeric"
                            autoComplete="cc-number"
                            placeholder="4242 4242 4242 4242"
                            value={card.number}
                            onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                            className="field-light tabular pl-9"
                            autoFocus
                          />
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-semibold text-abyss-900">Name on card</span>
                        <input
                          autoComplete="cc-name"
                          value={card.name}
                          onChange={(e) => setCard({ ...card, name: e.target.value })}
                          className="field-light"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-abyss-900">Expiry</span>
                          <input
                            placeholder="09/28"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            value={card.expiry}
                            onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                            className="field-light tabular"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-abyss-900">CVC</span>
                          <input
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            maxLength={4}
                            value={card.cvc}
                            onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '') })}
                            className="field-light tabular"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'upi' && (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-abyss-900">UPI ID</span>
                      <input
                        placeholder="yourname@bank"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        className="field-light"
                        autoFocus
                      />
                      <span className="mt-1 block text-[11px] text-slate-500">
                        You will approve the collect request in your UPI app.
                      </span>
                    </label>
                  )}

                  {paymentMethod === 'netbanking' && (
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-abyss-900">Your bank</span>
                      <select
                        value={bank}
                        onChange={(e) => setBank(e.target.value)}
                        className="field-light cursor-pointer"
                      >
                        {BANKS.map((b) => <option key={b}>{b}</option>)}
                      </select>
                      <span className="mt-1 block text-[11px] text-slate-500">
                        You will be redirected to your bank to authorise the debit.
                      </span>
                    </label>
                  )}

                  <div className="rounded-xl bg-sand px-4 py-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-abyss-900">
                      What happens after you pay
                    </p>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      Funds are captured, the volume is reserved against this lot, serial numbers
                      are assigned, the credits are transferred to you and then retired — cancelled
                      so they can never be resold. Your certificate is issued at the end.
                    </p>
                  </div>

                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                    <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
                    Demo gateway — no money moves and no card is charged. Connect Razorpay or
                    Stripe in
                    <code className="mx-1 font-mono">server/src/routes/market.routes.js</code>
                    to take live payments; everything after authorisation is already real.
                  </p>
                </div>
              )}

              {error && (
                <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {error}
                </p>
              )}

              <div className="mt-6 flex gap-2">
                {step > 0 && (
                  <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-light">
                    Back
                  </button>
                )}
                <button type="submit" className="btn-primary flex-1">
                  {step === 2 ? <Banknote size={15} aria-hidden /> : null}
                  {step === 2 ? `Pay ${money(quote.total)}` : 'Continue'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
