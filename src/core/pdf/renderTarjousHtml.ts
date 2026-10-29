import type { PdfFooter, PriceRow, TarjousPdfContext } from './buildPdfContext';
import { escapeHtml, escapeMultiline } from './escapeHtml';
import { renderKotitalousPageHtml } from './renderKotitalousPageHtml';
import { pdfStyles } from './pdfStyles';
import type { SpecGridLayout } from './specGridLayout';

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

function renderSpecGrid(grid: SpecGridLayout): string {
  if (grid.mode === 'none') return '';
  const cards = grid.cards
    .map((card) => {
      const rows = card.rows
        .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`)
        .join('');
      return `<div class="spec-card${card.fullWidth ? ' full' : ''}"><h2>${escapeHtml(card.title)}</h2><table>${rows}</table></div>`;
    })
    .join('\n');
  return `<div class="spec-grid">\n${cards}\n</div>`;
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
  return `<div class="additional-info"><h3>Lisätiedot:</h3><div>${escapeMultiline(text.trim())}</div></div>`;
}

/** Sivupohja: toistuva ylä-/alatunniste + sisältö. Käytetään myös KHV-sivulle (T8). */
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
  // KHV-sivu aina viimeisenä (vain yksityisasiakas ilman käänteistä ALV:ta).
  return [
    renderSpecGrid(ctx.specGrid),
    renderPriceBlock(ctx.price),
    renderAdditionalInfo(ctx.additionalInfo),
    renderKotitalousPageHtml(ctx),
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderTarjousHtml(ctx: TarjousPdfContext, options: RenderTarjousOptions = {}): string {
  return renderDocument(ctx, renderTarjousBody(ctx), options);
}
