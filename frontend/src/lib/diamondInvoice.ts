import { fmt, fmt0, prettyDate } from '@/lib/format';
import { DIAMOND_ICONS_PNG, DIAMOND_ARC_LOGO_PNG } from '@/lib/diamondAssets';
import type { Invoice } from '@/types';

// Diamond invoice — 80mm thermal roll, traced from the printed template.
// Every measurement below comes from that artwork: the sheet is 80mm wide with a
// 4mm margin each side, so the printable column is exactly 72mm.
const ROLL_WIDTH_MM = 80;
const ROLL_HEIGHT_MM = 220;
const SIDE_MARGIN_MM = 4;

// Item table column widths, as a share of the 72mm column. Qty is given a little
// more room than the blank template allows so a quantity never crowds the total.
const COLS = { code: '19%', desc: '32%', price: '19%', qty: '11%', total: '19%' };

// The template prints a fixed grid of item rows; short invoices keep the blank
// ones so the totals block always lands in the same place on the roll.
const MIN_ITEM_ROWS = 6;

// Both bands are fixed letterhead, exactly as printed on the pre-made pads.
const MANUFACTURER = {
  heading: 'Manufacturer:',
  name: 'Diamond Rainwear (Pvt) Ltd.',
  address: ['400/1, Colombo Road,', 'Pilimatalawa.'],
};

const DISTRIBUTOR = {
  heading: 'Distribute by',
  name: 'RAINCOUTURE',
  address: ['164/2, Uduwana, Homagama.', 'Tel: 077 546 1134'],
  wordmark: 'RainCouture',
  tagline: 'StepOutinStyle',
};

/**
 * RainCouture mark — the canopy seen from above.
 *
 * Eight panels meet at eight points, and each panel's outer edge scallops back
 * toward the centre, which is what gives the silhouette its umbrella shape
 * rather than a plain disc. Ribs read as white gaps between the panels, and the
 * ferrule sits above the top point. Drawn as vectors so it stays crisp at the
 * ~14mm it prints at.
 */
const RAINCOUTURE_MARK = `
  <svg class="dist-mark" viewBox="0 0 100 104" role="img" aria-label="RainCouture">
    <defs>
      <linearGradient id="rcA" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3c3c3c"/><stop offset="1" stop-color="#909090"/>
      </linearGradient>
      <linearGradient id="rcB" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#9c9c9c"/><stop offset="1" stop-color="#4c4c4c"/>
      </linearGradient>
    </defs>
    <g stroke="#fff" stroke-width="1.6" stroke-linejoin="round">
      <path d="M50,56 L50,12 Q61.48,28.28 81.11,24.89 Z" fill="url(#rcA)"/>
      <path d="M50,56 L81.11,24.89 Q77.72,44.52 94,56 Z" fill="url(#rcB)"/>
      <path d="M50,56 L94,56 Q77.72,67.48 81.11,87.11 Z" fill="url(#rcA)"/>
      <path d="M50,56 L81.11,87.11 Q61.48,83.72 50,100 Z" fill="url(#rcB)"/>
      <path d="M50,56 L50,100 Q38.52,83.72 18.89,87.11 Z" fill="url(#rcA)"/>
      <path d="M50,56 L18.89,87.11 Q22.28,67.48 6,56 Z" fill="url(#rcB)"/>
      <path d="M50,56 L6,56 Q22.28,44.52 18.89,24.89 Z" fill="url(#rcA)"/>
      <path d="M50,56 L18.89,24.89 Q38.52,28.28 50,12 Z" fill="url(#rcB)"/>
    </g>
    <path d="M50,12 L50,2" stroke="#3c3c3c" stroke-width="2.6" stroke-linecap="round"/>
  </svg>`;

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** One "label ....... value" line in the customer block. */
const field = (label: string, value: string, ruled = true): string => `
  <div class="fld">
    <span class="fld-l">${esc(label)}</span>
    <span class="fld-v${ruled ? ' ruled' : ''}">${esc(value)}</span>
  </div>`;

/**
 * Build the printable Diamond invoice.
 *
 * The two printed pads differ only in the letterhead: 'full' carries both the
 * manufacturer and the RainCouture distributor band and is what an invoice with
 * items goes out on; 'plain' is the manufacturer-only pad.
 */
export function diamondInvoiceHtml(d: Invoice, variant: 'full' | 'plain' = 'full'): string {
  const lines = d.lines ?? [];
  const blanks = Math.max(0, MIN_ITEM_ROWS - lines.length);

  const itemRows = lines.map((l) => `
    <tr>
      <td class="code">${esc(l.item?.code ?? '')}</td>
      <td class="desc">${esc(l.name)}</td>
      <td class="num">${fmt(Number(l.price))}</td>
      <td class="num">${fmt0(Number(l.qty))}</td>
      <td class="num">${fmt(Number(l.total ?? Number(l.qty) * Number(l.price)))}</td>
    </tr>`).join('');

  const blankRows = Array.from({ length: blanks }, () =>
    '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('');

  // Credit from goods this customer returned earlier, settled against this bill.
  // It prints under the discount because that is where it is taken off — the
  // money was already discounted on the invoice the goods went out on, so the
  // discount above it does not apply to it. Net Amount is already net of it.
  const returnCredit = Number(d.return_credit ?? 0);
  const returnCreditRow = returnCredit <= 0 ? '' :
    `<div class="tot"><span class="tot-l">Return Credit</span><span class="tot-v">${fmt(returnCredit)}</span></div>`;

  // Goods handed back off this bill, printed under the totals. The block only
  // exists when something actually came back — a slip with no return against it
  // should look exactly as it did before.
  const returnLines = (d.returns ?? []).flatMap((r) => r.lines ?? []);
  const returnedTotal = (d.returns ?? []).reduce((s, r) => s + Number(r.total), 0);
  const returnsBlock = returnLines.length === 0 ? '' : `
    <div class="rule"></div>
    <div class="ret-h">Sales Return</div>
    <table>
      <thead>
        <tr>
          <th class="l" style="width:22%">Item<br>Code</th>
          <th class="l" style="width:44%">Description</th>
          <th class="num" style="width:12%">Qty</th>
          <th class="num" style="width:22%">Value</th>
        </tr>
      </thead>
      <tbody>
        ${returnLines.map((l) => `
          <tr>
            <td class="code">${esc(l.item?.code ?? '')}</td>
            <td class="desc">${esc(l.name)}</td>
            <td class="num">${fmt0(Number(l.qty))}</td>
            <td class="num">${fmt(Number(l.total))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="tot net"><span class="tot-l">Returned Value</span><span class="tot-v">${fmt(returnedTotal)}</span></div>
    </div>`;

  const makerBand = `
    <div class="rule"></div>
    <div class="band">
      <img class="band-logo" src="${DIAMOND_ARC_LOGO_PNG}" alt="">
      <div class="band-txt">
        <div class="band-h">${MANUFACTURER.heading}</div>
        <div class="band-co">${MANUFACTURER.name}</div>
        ${MANUFACTURER.address.map((a) => `<div class="band-ad">${a}</div>`).join('')}
      </div>
    </div>`;

  const distributorBand = variant === 'plain' ? '' : `
    <div class="rule"></div>
    <div class="band">
      <div class="dist-logo">
        ${RAINCOUTURE_MARK}
        <div class="dist-word">${DISTRIBUTOR.wordmark}</div>
        <div class="dist-tag">${DISTRIBUTOR.tagline}</div>
      </div>
      <div class="band-txt">
        <div class="band-h">${DISTRIBUTOR.heading}</div>
        <div class="band-co">${DISTRIBUTOR.name}</div>
        ${DISTRIBUTOR.address.map((a) => `<div class="band-ad">${a}</div>`).join('')}
      </div>
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8">
  <title>${esc(d.no)} — Invoice</title>
  <style>
    /* Both lengths are required: "80mm auto" is invalid CSS, and a browser that
       drops the rule silently prints the slip on whatever paper is default. */
    @page { size: ${ROLL_WIDTH_MM}mm ${ROLL_HEIGHT_MM}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body {
      width: ${ROLL_WIDTH_MM}mm;
      padding: 3.8mm ${SIDE_MARGIN_MM}mm 6mm;
      color: #000;
      font-family: Arial, Helvetica, "Nimbus Sans", sans-serif;
      font-size: 8pt;
      line-height: 1.25;
    }

    .brand { font-size: 16pt; font-weight: 900; text-align: center; letter-spacing: .01em; }
    .icons { display: block; width: 33.9mm; margin: 0.9mm auto 0; }
    .doctype { font-size: 13pt; font-weight: 700; text-align: center; margin-top: 1.7mm; }

    /* The template separates each band with a heavy dashed rule. */
    .rule { border-top: 1.2pt dashed #000; margin: 2mm 0; }

    .band { display: flex; align-items: center; gap: 2mm; }
    .band-logo { width: 22mm; flex: 0 0 auto; }
    .band-txt { flex: 1; text-align: center; }
    .band-h { font-size: 10.5pt; font-weight: 700; }
    .band-co { font-size: 9.5pt; font-weight: 700; margin-top: 1.3mm; }
    .band-ad { font-size: 9pt; }

    .dist-logo { width: 22mm; flex: 0 0 auto; text-align: center; }
    .dist-mark { display: block; width: 14mm; height: auto; margin: 0 auto; }
    .dist-word { font-size: 8pt; font-weight: 700; margin-top: .8mm; }
    .dist-tag { font-size: 3.8pt; letter-spacing: .12em; }

    /* Labels stay on the first line so a wrapped address cannot drag them down. */
    .fld { display: flex; align-items: flex-start; gap: 1mm; min-height: 4.7mm; }
    .fld-l { flex: 0 0 25.2mm; }
    .fld-v { flex: 1; min-height: 3.4mm; }
    .fld-v.ruled { border-bottom: .75pt dotted #444; }

    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 2mm; }
    thead th {
      font-size: 7.5pt; font-weight: 700; padding: 1.6mm .6mm 1.5mm;
      border-top: .75pt dashed #000; border-bottom: .75pt dashed #000;
    }
    thead th.num, tbody td.num { text-align: right; }
    thead th.l { text-align: left; }
    tbody td { height: 4mm; padding: .5mm .6mm; border-bottom: .75pt dotted #666; vertical-align: top; }
    thead th:first-child, tbody td:first-child { padding-left: 0; }
    thead th:last-child, tbody td:last-child { padding-right: 0; }
    tbody td.desc { word-wrap: break-word; }
    /* A notch smaller so a typical item code holds one line in a 13mm column. */
    tbody td.code { font-size: 7.5pt; }

    .ret-h { font-size: 8.5pt; font-weight: 700; margin-bottom: .5mm; }

    .totals { margin-top: 3.4mm; }
    .tot { display: flex; align-items: flex-end; justify-content: flex-end; gap: 2.6mm; font-size: 8.5pt; min-height: 6.3mm; }
    .tot-l { text-align: right; }
    .tot-v { flex: 0 0 28.8mm; text-align: right; border-bottom: .75pt dotted #444; min-height: 3.6mm; }
    .tot.net { font-weight: 700; }

    .sign { margin-top: 11mm; }
    .sign-line { width: 43mm; border-top: .75pt solid #000; }
    .sign-cap { font-size: 8pt; margin-top: 1.4mm; }
  </style></head><body>

  <div class="brand">DIAMOND</div>
  <img class="icons" src="${DIAMOND_ICONS_PNG}" alt="">
  <div class="doctype">INVOICE</div>
  ${makerBand}
  ${distributorBand}
  <div class="rule"></div>

  ${field('Inv No:', d.no, false)}
  ${field('Date:', prettyDate(d.date))}
  ${field('Customer Name:', d.customer?.name ?? '')}
  ${field('Address:', d.customer?.address ?? '')}
  ${field('Phone:', d.customer?.phone ?? '')}

  <table>
    <thead>
      <tr>
        <th class="l" style="width:${COLS.code}">Item<br>Code</th>
        <th class="l" style="width:${COLS.desc}">Description</th>
        <th class="num" style="width:${COLS.price}">Price</th>
        <th class="num" style="width:${COLS.qty}">Qty</th>
        <th class="num" style="width:${COLS.total}">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}${blankRows}</tbody>
  </table>

  <div class="totals">
    <div class="tot"><span class="tot-l">Total</span><span class="tot-v">${fmt(Number(d.subtotal))}</span></div>
    <div class="tot"><span class="tot-l">Discount</span><span class="tot-v">${fmt(Number(d.discount_amount ?? 0))}</span></div>
    ${returnCreditRow}
    <div class="tot net"><span class="tot-l">Net Amount</span><span class="tot-v">${fmt(Number(d.total))}</span></div>
  </div>

  ${returnsBlock}

  <div class="sign">
    <div class="sign-line"></div>
    <div class="sign-cap">Customer Signature</div>
  </div>
  </body></html>`;
}
