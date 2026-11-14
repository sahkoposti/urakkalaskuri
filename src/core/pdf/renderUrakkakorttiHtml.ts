import { escapeHtml, renderMarkedMultiline } from './escapeHtml';
import { PDF_DEFAULT_ACCENT } from './pdfStyles';
import { renderPrintedGroups, renderPrintedLines, renderPrintedTable, printedSectionCss } from './renderPrintedSection';
import { renderDocument, type RenderTarjousOptions } from './renderTarjousHtml';
import type { UrakkakorttiSection } from './urakkakorttiSections';
import { urakkakorttiBodyBlocks, type UrakkakorttiBlockKind, type UrakkakorttiContext } from './urakkakortti';

const rowsTable = (rows: { label: string; value: string; emphasis?: boolean }[]) =>
  `<table>${rows
    .map(
      (row) =>
        `<tr${row.emphasis ? ' class="emphasis"' : ''}><td>${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('')}</table>`;

function renderUrakkakorttiSection(section: UrakkakorttiSection): string {
  const heading = `<h2 class="doc-heading">${escapeHtml(section.title)}</h2>`;
  const body = `${renderPrintedGroups(section.textGroups)}${renderPrintedTable(section.tableRows)}`;
  return `<section class="doc-section uk-section">${heading}${body}</section>`;
}

function renderUrakkakorttiBlock(ctx: UrakkakorttiContext, kind: UrakkakorttiBlockKind): string {
  if (kind === 'price') {
    const columns = [
      ctx.contractRows.length > 0 ? `<div class="col">${rowsTable(ctx.contractRows)}</div>` : '',
      ctx.infoRows.length > 0 ? `<div class="col">${rowsTable(ctx.infoRows)}</div>` : '',
    ].filter((column) => column.length > 0);
    if (columns.length === 0) return '';
    return `<div class="price-block">${columns.join('')}</div>`;
  }
  if (kind === 'specs') {
    const cards = ctx.specGrid.cards
      .map(
        (card) =>
          `<div class="spec-card${card.fullWidth ? ' full' : ''}"><h2>${escapeHtml(card.title)}</h2>${rowsTable(card.rows)}</div>`,
      )
      .join('\n');
    return `<div class="spec-grid">\n${cards}\n</div>`;
  }
  if (kind === 'print') return ctx.sections.map(renderUrakkakorttiSection).join('\n');
  if (kind === 'lisatiedot') {
    if (!ctx.structureLisatiedot.trim()) return '';
    return `<div class="additional-info uk-lisatiedot"><h3>Lisätiedot:</h3><div>${renderMarkedMultiline(ctx.structureLisatiedot)}</div></div>`;
  }
  if (kind === 'materials') {
    const ownPage = ctx.materials.some((m) => m.structureHeader);
    const rows = ctx.materials
      .map((m) => {
        if (m.structureHeader) {
          return `<tr class="uk-structure"><td colspan="2">${escapeHtml(m.product)}</td></tr>`;
        }
        if (m.shadeHeader) {
          return `<tr class="uk-shade-product"><td colspan="2">${escapeHtml(m.product)}</td></tr>`;
        }
        const qtyUnit = [m.quantity, m.unit].filter((part) => part.trim()).join(' ');
        const cls = m.shade ? ' class="uk-shade"' : '';
        return `<tr${cls}><td>${escapeHtml(m.product)}</td><td class="value">${escapeHtml(qtyUnit)}</td></tr>`;
      })
      .join('');
    const pageCls = ownPage ? ' uk-materials-page' : '';
    return `<div class="uk-materials${pageCls}"><h3>Materiaalit</h3><table><thead><tr><th>Tuote</th><th class="value">Määrä</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return `<div class="uk-huomio"><h3>Huomioitavaa</h3>${renderPrintedLines(ctx.huomioitavaa)}</div>`;
}

function renderUrakkakorttiTitle(ctx: UrakkakorttiContext): string {
  const ali = ctx.contractSum
    ? `<span class="uk-sum uk-sum-ali"><span class="uk-sum-label">Urakkasumma alihankkija</span><span class="uk-sum-value">${escapeHtml(ctx.contractSum)}</span></span>`
    : '';
  const emp = ctx.employeeSum
    ? `<span class="uk-sum uk-sum-emp"><span class="uk-sum-label">Urakkasumma työntekijä</span><span class="uk-sum-value">${escapeHtml(ctx.employeeSum)}</span></span>`
    : '';
  const sums = ali || emp ? `<span class="uk-sums">${ali}${emp}</span>` : '';
  return `<h1 class="uk-title"><span class="uk-title-text">${escapeHtml(ctx.modeLabel)}</span>${sums}</h1>`;
}

export function renderUrakkakorttiBody(ctx: UrakkakorttiContext, attachmentHtml = ''): string {
  const parts: string[] = [renderUrakkakorttiTitle(ctx)];
  for (const kind of urakkakorttiBodyBlocks(ctx)) parts.push(renderUrakkakorttiBlock(ctx, kind));
  if (attachmentHtml) parts.push(attachmentHtml);
  return parts.join('\n');
}

function urakkakorttiCss(accent: string): string {
  return `
  body.doc-card { background: #fff; }
  .uk-title { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; margin: 0 0 4mm 0; padding: 0 0 2mm 0; font-size: 17pt; font-weight: 700; border-bottom: 1.2mm solid ${accent}; }
  .uk-title-text { font-weight: 700; letter-spacing: 0.01em; }
  .uk-sums { margin-left: auto; text-align: right; }
  .uk-sum { display: block; white-space: nowrap; margin: 0 0 1mm 0; }
  .uk-sum-label { display: block; font-size: 8.5pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${accent}; }
  .uk-sum-value { display: block; font-size: 16pt; font-weight: 700; color: ${accent}; }
  .uk-sum-emp .uk-sum-value { font-size: 15pt; }
  .uk-materials { margin: 0 0 6mm 0; }
  .uk-materials.uk-materials-page { break-before: page; page-break-before: always; }
  .uk-materials h3 { margin: 0 0 1.5mm 0; font-size: 12pt; break-after: avoid; page-break-after: avoid; }
  .uk-materials table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .uk-materials tr { break-inside: avoid; page-break-inside: avoid; }
  .uk-materials th, .uk-materials td { text-align: left; padding: 0.8mm 2mm 0.8mm 0; border-bottom: 1px solid #ddd; color: #111; }
  .uk-materials .value { text-align: right; }
  .uk-materials tr.uk-structure td { font-weight: 700; font-size: 11.5pt; border-bottom: none; padding-top: 2.4mm; }
  .uk-materials tr.uk-shade-product td { font-weight: 700; border-bottom: none; padding-top: 1.6mm; }
  .uk-materials tr.uk-shade td:first-child { padding-left: 5mm; }
  .uk-lisatiedot { margin: 4mm 0 6mm 0; }
`;
}

const HEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export function renderUrakkakorttiHtml(ctx: UrakkakorttiContext, options: RenderTarjousOptions = {}): string {
  const accent = options.accentColor && HEX.test(options.accentColor) ? options.accentColor : PDF_DEFAULT_ACCENT;
  const css = `${urakkakorttiCss(accent)}${printedSectionCss}`;
  return renderDocument(ctx, renderUrakkakorttiBody(ctx, options.attachmentHtml ?? ''), {
    ...options,
    bodyClass: 'doc-card',
  }).replace('</style>', `${css}</style>`);
}
