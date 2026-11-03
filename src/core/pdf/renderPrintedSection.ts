import { escapeHtml } from './escapeHtml';
import type { PrintedTableRow, PrintedTextGroup } from './printedSection';

/** Rivinvaihdot omiksi riveiksi. HTML escapeataan, rivejä ei yhdistetä. */
export function renderPrintedLines(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `<p class="doc-line">${escapeHtml(line)}</p>`)
    .join('');
}

export function renderPrintedGroups(groups: PrintedTextGroup[]): string {
  return groups
    .map((group) => {
      const lines = group.items.map((item) => renderPrintedLines(item)).join('');
      const title = group.title.trim()
        ? `<p class="doc-group-title">${escapeHtml(group.title)}</p>`
        : '';
      return `<div class="doc-group doc-group-${group.group}">${title}${lines}</div>`;
    })
    .join('');
}

export function renderPrintedTable(rows: PrintedTableRow[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td class="value">${escapeHtml(row.value)}</td></tr>`)
    .join('');
  return `<table class="doc-fields">${body}</table>`;
}

export const printedSectionCss = `
  .doc-section { margin: 0 0 5mm 0; }
  .doc-heading, .offer-line-heading { break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
  .doc-heading { margin: 3mm 0 1.5mm 0; font-size: 12pt; }
  .offer-line-heading { display: flex; align-items: baseline; gap: 2mm; margin: 3mm 0 2mm 0; font-size: 12pt; }
  .offer-line-title { font-weight: 700; }
  .offer-line-leader { flex: 1 1 auto; border-bottom: 1px dotted #666; min-width: 8mm; height: 0; }
  .offer-line-qty, .offer-line-price { white-space: nowrap; }
  .offer-line-vat { font-size: 8pt; white-space: nowrap; }
  .doc-desc { margin: 0 0 3mm 0; }
  .doc-group { margin: 0 0 3mm 0; break-inside: avoid; page-break-inside: avoid; }
  .doc-group-muuta { margin-top: 4mm; }
  .doc-group-tieto { margin-top: 4mm; padding-top: 2mm; border-top: 1px solid #ccc; }
  .doc-group-title { margin: 0 0 1mm 0; font-weight: 700; }
  .doc-line { margin: 0 0 1mm 0; break-inside: avoid; page-break-inside: avoid; }
  .doc-fields { width: 100%; border-collapse: collapse; margin: 0 0 3mm 0; font-size: 10pt; }
  .doc-fields tr { break-inside: avoid; page-break-inside: avoid; }
  .doc-fields td { padding: 0.6mm 2mm 0.6mm 0; vertical-align: top; border-bottom: 1px solid #eee; }
  .doc-fields td.value { text-align: right; }
  .uk-huomio { margin-top: 4mm; }
  .uk-huomio h3 { margin: 0 0 1.5mm 0; font-size: 11pt; break-after: avoid; page-break-after: avoid; }
`;
