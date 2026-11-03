import type { PdfFooter, PriceRow, TarjousPdfContext } from './buildPdfContext';
import { escapeHtml, escapeMultiline } from './escapeHtml';
import { renderKotitalousPageHtml } from './renderKotitalousPageHtml';
import { offerDocumentCss, pdfStyles } from './pdfStyles';
import type { OfferSection, OfferVatSummaryRow } from './offerDocument';
import { renderPrintedGroups, renderPrintedLines, renderPrintedTable, printedSectionCss } from './renderPrintedSection';
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

function renderDelivery(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return `<p class="offer-delivery">Toimitusajankohta: ${escapeHtml(trimmed)}</p>`;
}

function offerColGroup(): string {
  return '<colgroup><col class="c-name" /><col class="c-qty" /><col class="c-unit" /><col class="c-unitprice" /><col class="c-vat" /><col class="c-total" /></colgroup>';
}

/** Sarakeotsikot kerran tarjousta kohden, ensimmäisen hinnoitellun otsikon yläpuolella. */
function renderOfferColumnHeader(): string {
  return `<table class="offer-cols-head">${offerColGroup()}<thead><tr><th>Nimike</th><th class="num">Määrä</th><th>Yks.</th><th class="num">A-hinta</th><th class="num">Alv-%</th><th class="num">Yht</th></tr></thead></table>`;
}

function renderHeadingRow(section: OfferSection): string {
  const heading = section.heading;
  if (!heading) return `<h2 class="doc-heading">${escapeHtml(section.title)}</h2>`;
  return `<table class="offer-line-heading">${offerColGroup()}<tbody><tr><td class="offer-line-title">${escapeHtml(section.title)}</td><td class="num offer-line-qty">${escapeHtml(heading.quantity)}</td><td class="offer-line-unit">${escapeHtml(heading.unit)}</td><td class="num offer-line-unitprice">${escapeHtml(heading.unitPrice)}</td><td class="num offer-line-vat">${escapeHtml(heading.vatLabel ?? '')}</td><td class="num offer-line-price">${escapeHtml(heading.price)}</td></tr></tbody></table>`;
}

function renderSection(section: OfferSection, showColumnHeader: boolean): string {
  const heading = `${showColumnHeader ? renderOfferColumnHeader() : ''}${renderHeadingRow(section)}`;
  const description = section.description?.trim()
    ? `<div class="doc-desc">${renderPrintedLines(section.description.trim())}</div>`
    : '';
  const body = `${renderPrintedGroups(section.textGroups)}${renderPrintedTable(section.tableRows)}`;
  return `<section class="doc-section offer-section">${heading}${description}${body}</section>`;
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

function signatureNameCell(role: string, lines: string[]): string {
  const details = lines.map((line) => `<p class="offer-sign-detail">${escapeHtml(line)}</p>`).join('');
  return `<td><p class="offer-sign-role">${role}</p><div class="offer-sign-name">${details}</div></td>`;
}

function signatureLineCell(label: string): string {
  return `<td><p class="offer-sign-label">${label}</p><div class="offer-sign-line"></div></td>`;
}

function renderSignature(signature: TarjousPdfContext['signature']): string {
  const customer = signature.customerName ? [signature.customerName] : [];
  return `<table class="offer-sign"><tr class="offer-sign-names">${signatureNameCell('Myyjä', signature.sellerLines)}${signatureNameCell('Tilaaja', customer)}</tr><tr class="offer-sign-pen">${signatureLineCell('Allekirjoitus')}${signatureLineCell('Allekirjoitus')}</tr><tr class="offer-sign-date">${signatureLineCell('Päiväys')}${signatureLineCell('Päiväys')}</tr></table>`;
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
  // Sarakeotsikko kerran, ensimmäisen hinnoitellun rakenneotsikon yläpuolella.
  // Toimitus jää osioiden edelle.
  let columnHeaderPlaced = false;
  const sections = ctx.sections.map((section) => {
    const showColumnHeader = Boolean(section.heading) && !columnHeaderPlaced;
    if (showColumnHeader) columnHeaderPlaced = true;
    return renderSection(section, showColumnHeader);
  });
  return [
    renderDelivery(ctx.deliveryScheduleText),
    ...sections,
    renderPriceBlock(ctx.price),
    renderVatSummary(ctx.vatSummary),
    renderAdditionalInfo(ctx.additionalInfo),
    renderSeller(ctx.sellerLines),
    renderSignature(ctx.signature),
    renderKotitalousPageHtml(ctx),
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderTarjousHtml(ctx: TarjousPdfContext, options: RenderTarjousOptions = {}): string {
  return renderDocument(ctx, renderTarjousBody(ctx), options).replace(
    '</style>',
    `${printedSectionCss}${offerDocumentCss}</style>`,
  );
}
