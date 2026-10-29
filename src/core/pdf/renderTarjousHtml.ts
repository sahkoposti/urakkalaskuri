import type { PdfFooter, PriceRow, TarjousPdfContext } from './buildPdfContext';
import { escapeHtml, escapeMultiline } from './escapeHtml';
import { renderKotitalousPageHtml } from './renderKotitalousPageHtml';
import { offerDocumentCss, pdfStyles } from './pdfStyles';
import type { OfferRow, OfferSection, OfferVatSummaryRow } from './offerDocument';
import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';

export type RenderTarjousOptions = {
  /** data:-URI (logoDataUri.ts). Puuttuu → logopalsta tyhjä. */
  logoDataUri?: string | null;
  accentColor?: string;
  /** Kaksivaiheinen sivunumero-fallback (T1). */
  knownTotalPages?: number | null;
};

const lines = (values: string[]) => values.map((value) => escapeHtml(value)).join('<br />');

function renderHeader(ctx: Pick<TarjousPdfContext, 'customerLines' | 'offerInfo'>, logoDataUri?: string | null): string {
  const [name, ...rest] = ctx.customerLines;
  const logo = logoDataUri ? `<img class="logo" src="${escapeHtml(logoDataUri)}" alt="" />` : '';
  const offerRows = ctx.offerInfo
    .map((row) => `<tr><td class="label">${escapeHtml(row.label)}</td><td>${escapeHtml(row.value)}</td></tr>`)
    .join('');
  return `<div class="header">
  <div class="logo-col">${logo}</div>
  <div class="customer">${name ? `<div class="name">${escapeHtml(name)}</div>` : ''}${lines(rest)}</div>
  <div class="offer"><table>${offerRows}</table></div>
</div>`;
}

export function renderFooter(footer: PdfFooter): string {
  return `<div class="footer">
  <div class="col">${lines(footer.left)}</div>
  <div class="col">${lines(footer.center)}</div>
  <div class="col">${lines(footer.right)}</div>
</div>`;
}

function renderOfferRows(rows: OfferRow[], includesVat: boolean): string {
  const showDiscount = rows.some((row) => row.discountPercent !== undefined);
  const headers = [
    { label: 'Nimike', numeric: false },
    { label: 'Määrä', numeric: true },
    { label: 'Yks.', numeric: false },
    { label: includesVat ? 'A-hinta (sis. alv)' : 'A-hinta (alv 0 %)', numeric: true },
    { label: 'Alv-%', numeric: true },
    ...(showDiscount ? [{ label: 'Ale %', numeric: true }] : []),
    { label: 'Yht.', numeric: true },
  ];
  const head = `<thead><tr>${headers
    .map((header) => `<th${header.numeric ? ' class="num"' : ''}>${escapeHtml(header.label)}</th>`)
    .join('')}</tr></thead>`;
  const body = rows
    .map((row) => {
      const cells: { text: string; numeric: boolean }[] = [
        { text: row.name, numeric: false },
        { text: row.quantity, numeric: true },
        { text: row.unit, numeric: false },
        { text: row.unitPrice, numeric: true },
        { text: row.vatPercent, numeric: true },
        ...(showDiscount ? [{ text: row.discountPercent ?? '', numeric: true }] : []),
        { text: row.total, numeric: true },
      ];
      const main = `<tr>${cells
        .map((cell) => `<td${cell.numeric ? ' class="num"' : ''}>${escapeHtml(cell.text)}</td>`)
        .join('')}</tr>`;
      const description = row.description
        ? `<tr class="offer-desc"><td colspan="${cells.length}">${escapeMultiline(row.description)}</td></tr>`
        : '';
      return `<tbody class="offer-line">${main}${description}</tbody>`;
    })
    .join('');
  return `<table class="offer-rows">${head}${body}</table>`;
}

function renderDelivery(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return `<p class="offer-delivery">Toimitusajankohta: ${escapeHtml(trimmed)}</p>`;
}

function renderSection(section: OfferSection): string {
  const parts = [`<h2>${escapeHtml(section.title)}</h2>`];
  if (section.areas) parts.push(`<p class="offer-areas">${escapeHtml(section.areas)}</p>`);
  if (section.phases.length > 0) {
    const items = section.phases.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    parts.push(`<div class="offer-phases"><p>Työvaiheet:</p><ul>${items}</ul></div>`);
  }
  if (section.notes.length > 0) {
    const notes = section.notes.map((item) => `<p>${escapeMultiline(item)}</p>`).join('');
    parts.push(`<div class="offer-notes"><p>Muuta:</p>${notes}</div>`);
  }
  for (const fact of section.facts) parts.push(`<p class="offer-fact">${escapeHtml(fact)}</p>`);
  for (const paint of section.paints) parts.push(`<p class="offer-paint">${escapeHtml(paint)}</p>`);
  if (section.workDuration) parts.push(`<p class="offer-duration">${escapeHtml(section.workDuration)}</p>`);
  return `<section class="offer-section">${parts.join('')}</section>`;
}

function renderVatSummary(rows: OfferVatSummaryRow[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(formatPercent(row.vatPercent))}</td><td class="num">${escapeHtml(formatCurrency(row.net))}</td><td class="num">${escapeHtml(formatCurrency(row.vat))}</td><td class="num">${escapeHtml(formatCurrency(row.gross))}</td></tr>`,
    )
    .join('');
  return `<table class="offer-vat"><thead><tr><th>Alv-%</th><th class="num">Veroton</th><th class="num">Alv</th><th class="num">Yhteensä</th></tr></thead><tbody>${body}</tbody></table>`;
}

function renderSeller(lines: string[]): string {
  if (lines.length === 0) return '';
  return `<div class="offer-seller"><h3>Myyjä:</h3><div>${lines.map((line) => escapeHtml(line)).join('<br />')}</div></div>`;
}

function priceTable(rows: PriceRow[]): string {
  return `<table>${rows
    .map(
      (row) =>
        `<tr${row.emphasis ? ' class="emphasis"' : ''}><td>${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('')}</table>`;
}

function renderPriceBlock(price: TarjousPdfContext['price']): string {
  return `<div class="price-block"><div class="col">${priceTable(price.left)}</div><div class="col">${priceTable(price.right)}</div></div>`;
}

function renderAdditionalInfo(text: string): string {
  if (!text.trim()) return '';
  return `<div class="additional-info"><h3>Lisätiedot:</h3><div>${escapeMultiline(text)}</div></div>`;
}

/** Sivupohja: toistuva ylä-/alatunniste + sisältö. Käytetään myös KTV-sivulle (T8). */
export function renderDocument(
  ctx: Pick<TarjousPdfContext, 'customerLines' | 'offerInfo' | 'footer'>,
  bodyHtml: string,
  options: RenderTarjousOptions = {},
): string {
  return `<!DOCTYPE html>
<html lang="fi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${pdfStyles({ accentColor: options.accentColor, knownTotalPages: options.knownTotalPages })}</style>
</head>
<body>
${renderHeader(ctx, options.logoDataUri)}
${renderFooter(ctx.footer)}
<table class="layout">
<thead><tr><td class="spacer-top"></td></tr></thead>
<tfoot><tr><td class="spacer-bottom"></td></tr></tfoot>
<tbody><tr><td>
${bodyHtml}
</td></tr></tbody>
</table>
</body>
</html>`;
}

export function renderTarjousBody(ctx: TarjousPdfContext): string {
  // KTV-sivu aina viimeisenä (vain yksityisasiakas ilman käänteistä ALV:ta).
  return [
    renderOfferRows(ctx.rows, ctx.price.includesVat),
    renderDelivery(ctx.deliveryScheduleText),
    ...ctx.sections.map(renderSection),
    renderPriceBlock(ctx.price),
    renderVatSummary(ctx.vatSummary),
    renderAdditionalInfo(ctx.additionalInfo),
    renderSeller(ctx.sellerLines),
    renderKotitalousPageHtml(ctx),
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderTarjousHtml(ctx: TarjousPdfContext, options: RenderTarjousOptions = {}): string {
  return renderDocument(ctx, renderTarjousBody(ctx), options).replace('</style>', `${offerDocumentCss}</style>`);
}
