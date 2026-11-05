import { escapeHtml } from './escapeHtml';
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
  if (kind === 'materials') {
    const rows = ctx.materials
      .map((m) => `<tr><td>${escapeHtml(m.product)}</td><td class="value">${escapeHtml(m.quantity)}</td><td>${escapeHtml(m.unit)}</td></tr>`)
      .join('');
    return `<div class="uk-materials"><h3>Materiaalit</h3><table><thead><tr><th>Tuote</th><th class="value">Määrä</th><th>Yksikkö</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return `<div class="uk-huomio"><h3>Huomioitavaa</h3>${renderPrintedLines(ctx.huomioitavaa)}</div>`;
}

function renderUrakkakorttiTitle(ctx: UrakkakorttiContext): string {
  const sum = ctx.contractSum
    ? `<span class="uk-sum"><span class="uk-sum-label">Urakan summa</span><span class="uk-sum-value">${escapeHtml(ctx.contractSum)}</span></span>`
    : '';
  return `<h1 class="uk-title"><span class="uk-title-text">${escapeHtml(ctx.modeLabel)}</span>${sum}</h1>`;
}

export function renderUrakkakorttiBody(ctx: UrakkakorttiContext, attachmentHtml = ''): string {
  const parts: string[] = [renderUrakkakorttiTitle(ctx)];
  for (const kind of urakkakorttiBodyBlocks(ctx)) parts.push(renderUrakkakorttiBlock(ctx, kind));
  if (attachmentHtml) parts.push(attachmentHtml);
  return parts.join('\n');
}

const URAKKAKORTTI_CSS = `
  .uk-title { display: flex; justify-content: space-between; align-items: baseline; gap: 6mm; margin: 0 0 4mm 0; font-size: 17pt; font-weight: 700; }
  .uk-title-text { font-weight: 700; }
  .uk-sum { margin-left: auto; text-align: right; white-space: nowrap; }
  .uk-sum-label { display: block; font-size: 9pt; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .uk-sum-value { display: block; font-size: 17pt; font-weight: 700; }
  .uk-materials { margin: 0 0 6mm 0; }
  .uk-materials h3 { margin: 0 0 1.5mm 0; font-size: 12pt; break-after: avoid; page-break-after: avoid; }
  .uk-materials table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .uk-materials tr { break-inside: avoid; page-break-inside: avoid; }
  .uk-materials th, .uk-materials td { text-align: left; padding: 0.8mm 2mm 0.8mm 0; border-bottom: 1px solid #ddd; }
  .uk-materials .value { text-align: right; }
`;

export function renderUrakkakorttiHtml(ctx: UrakkakorttiContext, options: RenderTarjousOptions = {}): string {
  const css = `${URAKKAKORTTI_CSS}${printedSectionCss}`;
  return renderDocument(ctx, renderUrakkakorttiBody(ctx, options.attachmentHtml ?? ''), options).replace(
    '</style>',
    `${css}</style>`,
  );
}
