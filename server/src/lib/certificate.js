import PDFDocument from 'pdfkit';

/*
 * Retirement certificate as a real PDF.
 *
 * Everything is drawn with PDFKit's built-in Helvetica/Courier faces. Those are
 * WinAnsi-encoded and silently drop anything outside that set, so the copy here
 * stays ASCII: "INR" not the rupee sign, "tCO2e" not a subscript two, and plain
 * hyphens or commas in place of em dashes.
 */

const INK = '#062229';
const TEAL = '#0B5F52';
const GREEN = '#0E9F6E';
const MUTED = '#5B7C77';
const RULE = '#CFE7DE';
const PAPER = '#FBFDFC';

const PAGE = { width: 841.89, height: 595.28 }; // A4 landscape
const M = 46;

const inr = (n) =>
  `INR ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const longDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

const pad = (n) => String(n).padStart(6, '0');

/** The registry mark: a mangrove leaf over two tide lines. */
function drawMark(doc, x, y, size) {
  const s = size / 32;
  doc.save().translate(x, y).scale(s);
  doc.roundedRect(0, 0, 32, 32, 9).fill(INK);
  doc.path('M16 5c3.6 3.4 5.4 6.6 5.4 9.6 0 3.2-2.4 5.6-5.4 5.6s-5.4-2.4-5.4-5.6C10.6 11.6 12.4 8.4 16 5Z')
    .fill(GREEN);
  doc.path('M5 23.5c2.2-1.6 4-1.6 6.2 0 2.2 1.6 4 1.6 6.2 0 2.2-1.6 4-1.6 6.2 0')
    .lineWidth(2.2).strokeColor('#2BC4C4').stroke();
  doc.restore();
}

function label(doc, text, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(7).fillColor(MUTED)
    .text(text.toUpperCase(), x, y, { width, characterSpacing: 1.1 });
}

function value(doc, text, x, y, width, { mono = false, size = 10.5 } = {}) {
  doc.font(mono ? 'Courier-Bold' : 'Helvetica-Bold').fontSize(size).fillColor(INK)
    .text(String(text ?? '-'), x, y, { width, lineGap: 1 });
}

/**
 * Streams a retirement certificate for one order.
 * `order` is a row from `orders` joined with its project and community.
 */
export function buildCertificate(order, { verifyUrl } = {}) {
  const doc = new PDFDocument({ size: [PAGE.width, PAGE.height], margin: 0, info: {
    Title: `Blue Carbon Retirement Certificate ${order.reference}`,
    Author: 'Blue Carbon Registry',
    Subject: `${order.tonnes} tCO2e retired from ${order.project_code}`,
  } });

  const right = PAGE.width - M;
  const inner = right - M;

  // ---------------------------------------------------------------- canvas
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(PAPER);
  doc.rect(0, 0, PAGE.width, 8).fill(GREEN);
  doc.rect(0, PAGE.height - 26, PAGE.width, 26).fill(INK);

  // A soft tide arc in the lower right, well clear of the text.
  doc.save().opacity(0.06);
  doc.path(`M ${PAGE.width - 300} ${PAGE.height} q 150 -180 300 -140 L ${PAGE.width} ${PAGE.height} Z`).fill(TEAL);
  doc.restore();

  // ---------------------------------------------------------------- header
  let y = 40;
  drawMark(doc, M, y, 34);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK)
    .text('Blue Carbon Registry', M + 46, y + 3);
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('COASTAL RESTORATION AND CREDIT REGISTRY', M + 46, y + 19, { characterSpacing: 1 });

  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('CERTIFICATE REFERENCE', right - 200, y + 2, { width: 200, align: 'right', characterSpacing: 1 });
  doc.font('Courier-Bold').fontSize(13).fillColor(TEAL)
    .text(order.reference, right - 200, y + 15, { width: 200, align: 'right' });

  y += 54;
  doc.moveTo(M, y).lineTo(right, y).lineWidth(1).strokeColor(RULE).stroke();

  // ------------------------------------------------------------- statement
  y += 30;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text('CERTIFICATE OF RETIREMENT', M, y, { characterSpacing: 2.4 });

  y += 20;
  doc.font('Helvetica').fontSize(11).fillColor(MUTED).text('This certifies that', M, y);

  y += 20;
  doc.font('Helvetica-Bold').fontSize(27).fillColor(INK)
    .text(order.beneficiary || order.buyer_name, M, y, { width: inner, lineGap: 0 });

  y = doc.y + 12;
  doc.font('Helvetica').fontSize(11).fillColor(MUTED)
    .text('has permanently retired', M, y, { continued: true })
    .font('Helvetica-Bold').fontSize(11).fillColor(GREEN)
    .text(`  ${Number(order.tonnes).toLocaleString('en-IN')} tCO2e  `, { continued: true })
    .font('Helvetica').fillColor(MUTED)
    .text('of verified blue carbon removals, grown and monitored by');

  y = doc.y + 4;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(TEAL)
    .text(`${order.community_name}, ${order.district}, ${order.state}`, M, y, { width: inner });

  // ------------------------------------------------------------ detail grid
  y = doc.y + 26;
  doc.moveTo(M, y).lineTo(right, y).lineWidth(1).strokeColor(RULE).stroke();

  const gridTop = y + 18;
  const colW = (inner - 36) / 4;
  const col = (i) => M + i * (colW + 12);

  const cells = [
    ['Project', `${order.project_code}\n${order.project_name}`, false],
    ['Ecosystem', String(order.ecosystem || '').replace(/^./, (c) => c.toUpperCase()), false],
    ['Vintage', order.vintage_year, false],
    ['Volume retired', `${Number(order.tonnes).toLocaleString('en-IN')} tCO2e`, false],
  ];
  cells.forEach(([l, v, mono], i) => {
    label(doc, l, col(i), gridTop, colW);
    value(doc, v, col(i), gridTop + 12, colW, { mono });
  });

  const row2 = gridTop + 56;
  const cells2 = [
    ['Retirement date', longDate(order.retired_at || order.created_at), false],
    ['Payment', `${String(order.payment_method || '').toUpperCase()} ${order.payment_reference || ''}`.trim(), true],
    ['Amount paid', inr(order.total_amount), false],
    ['Registry status', 'Retired / cancelled', false],
  ];
  cells2.forEach(([l, v, mono], i) => {
    label(doc, l, col(i), row2, colW);
    value(doc, v, col(i), row2 + 12, colW, { mono, size: mono ? 9 : 10.5 });
  });

  // ------------------------------------------------------------ serial band
  const bandY = row2 + 54;
  doc.roundedRect(M, bandY, inner, 54, 10).fill('#F1F9F5');
  doc.roundedRect(M, bandY, 4, 54, 2).fill(GREEN);

  label(doc, 'Serial numbers cancelled', M + 18, bandY + 12, 300);
  const serials = order.serial_start
    ? `${order.project_code}-${pad(order.serial_start)}  to  ${order.project_code}-${pad(order.serial_end)}`
    : 'Not assigned';
  doc.font('Courier-Bold').fontSize(12).fillColor(INK).text(serials, M + 18, bandY + 26);

  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED)
    .text('These serials cannot be resold,\ntransferred or claimed again.',
      right - 180, bandY + 14, { width: 162, align: 'right', lineGap: 2 });

  // ---------------------------------------------------------------- footer
  const footY = bandY + 70;
  doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(
    'Credits are issued against a government-surveyed boundary and discounted by the community\'s measured daily participation. '
    + 'Proceeds net of registry fees are distributed to the households that grew and monitored this carbon.',
    M, footY, { width: inner - 190, lineGap: 2.5 }
  );

  doc.font('Helvetica').fontSize(7).fillColor(MUTED)
    .text('ISSUED BY', right - 180, footY, { width: 180, align: 'right', characterSpacing: 1 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK)
    .text('Blue Carbon Registry', right - 180, footY + 11, { width: 180, align: 'right' });

  doc.font('Helvetica').fontSize(7).fillColor('#8FB9AF').text(
    verifyUrl ? `Verify this certificate at ${verifyUrl}` : `Verify with reference ${order.reference}`,
    M, PAGE.height - 18, { width: inner, align: 'center' }
  );

  doc.end();
  return doc;
}
