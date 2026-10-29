import { escapeHtml, escapeMultiline } from './escapeHtml';
import { renderDocument, type RenderTarjousOptions } from './renderTarjousHtml';
import type { UrakkakorttiSection } from './urakkakorttiSections';
import type { UrakkakorttiContext } from './urakkakortti';

const rowsTable = (rows: { label: string; value: string; emphasis?: boolean }[]) =>
  `<table>${rows
    .map(
      (row) =>
        `<tr${row.emphasis ? ' class="emphasis"' : ''}><td>${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`,
    )
    .join('')}</table>`;

function renderUrakkakorttiSection(section: UrakkakorttiSection): string {
  const parts = [`<h2>${escapeHtml(section.title)}</h2>`];
  if (section.areas) parts.push(`<p class="uk-section-areas">${escapeHtml(section.areas)}</p>`);
  if (section.phases.length > 0) {
    const items = section.phases.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    parts.push(`<div class="uk-section-phases"><p>Työvaiheet:</p><ul>${items}</ul></div>`);
  }
  if (section.notes.length > 0) {
    const notes = section.notes.map((item) => `<p>${escapeMultiline(item)}</p>`).join('');
    parts.push(`<div class="uk-section-notes"><p>Muuta:</p>${notes}</div>`);
  }
  for (const fact of section.facts) parts.push(`<p class="uk-section-fact">${escapeHtml(fact)}</p>`);
  for (const paint of section.paints) parts.push(`<p class="uk-section-paint">${escapeHtml(paint)}</p>`);
  return `<section class="uk-section">${parts.join('')}</section>`;
}

export function renderUrakkakorttiBody(ctx: UrakkakorttiContext): string {
  const parts: string[] = ['<h1 class="uk-title">Urakkakortti</h1>'];
  parts.push(`<div class="price-block"><div class="col">${rowsTable(ctx.contractRows)}</div><div class="col">${rowsTable(ctx.infoRows)}</div></div>`);
  if (ctx.specGrid.mode !== 'none') {
    const cards = ctx.specGrid.cards
      .map(
        (card) =>
          `<div class="spec-card${card.fullWidth ? ' full' : ''}"><h2>${escapeHtml(card.title)}</h2>${rowsTable(card.rows)}</div>`,
      )
      .join('\n');
    parts.push(`<div class="spec-grid">\n${cards}\n</div>`);
  }
  if (ctx.sections.length > 0) {
    parts.push(ctx.sections.map(renderUrakkakorttiSection).join('\n'));
  }
  if (ctx.materials.length > 0) {
    const rows = ctx.materials
      .map((m) => `<tr><td>${escapeHtml(m.product)}</td><td class="value">${escapeHtml(m.quantity)}</td><td>${escapeHtml(m.unit)}</td></tr>`)
      .join('');
    parts.push(
      `<div class="uk-materials"><h3>Materiaalit</h3><table><thead><tr><th>Tuote</th><th class="value">Määrä</th><th>Yksikkö</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    );
  }
  if (ctx.customerNotes) {
    parts.push(`<div class="additional-info"><h3>Asiakkaan lisätiedot:</h3><div>${escapeMultiline(ctx.customerNotes)}</div></div>`);
  }
  parts.push('<div class="uk-notes"><h3>Muistiinpanot:</h3><div class="uk-notes-area"></div></div>');
  return parts.join('\n');
}

const URAKKAKORTTI_CSS = `
  .uk-title { margin: 0 0 4mm 0; font-size: 16pt; }
  .uk-materials { margin: 0 0 6mm 0; page-break-inside: avoid; break-inside: avoid; }
  .uk-materials h3, .uk-notes h3 { margin: 0 0 1.5mm 0; font-size: 11pt; }
  .uk-materials table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .uk-materials th, .uk-materials td { text-align: left; padding: 0.8mm 2mm 0.8mm 0; border-bottom: 1px solid #ddd; }
  .uk-materials .value { text-align: right; }
  .uk-notes { margin-top: 6mm; page-break-inside: avoid; break-inside: avoid; }
  .uk-notes-area { height: 60mm; border: 1px solid #999; }
`;

/** Lisätään vain, kun osioita on. Vanhan pohjan HTML pysyy tavulleen samana. */
const URAKKAKORTTI_SECTION_CSS = `
  .uk-section { margin: 0 0 5mm 0; break-inside: avoid; page-break-inside: avoid; }
  .uk-section h2 { margin: 3mm 0 1.5mm 0; font-size: 12pt; }
  .uk-section p { margin: 0 0 1.5mm 0; }
  .uk-section ul { margin: 0 0 2mm 4mm; padding: 0; }
  .uk-section li { margin: 0; }
`;

export function renderUrakkakorttiHtml(ctx: UrakkakorttiContext, options: RenderTarjousOptions = {}): string {
  const css = ctx.sections.length > 0 ? `${URAKKAKORTTI_CSS}${URAKKAKORTTI_SECTION_CSS}` : URAKKAKORTTI_CSS;
  return renderDocument(ctx, renderUrakkakorttiBody(ctx), options).replace('</style>', `${css}</style>`);
}
