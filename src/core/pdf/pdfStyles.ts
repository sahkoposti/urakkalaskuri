/**
 * Tarjous-PDF:n print-CSS (T7). T1-havainnot (desktop Chrome, EI vielä Android-laitteella):
 * - Sivunumero: @page @bottom-right counter(page)/counter(pages) toimii; counter(pages) fixed-footerissa EI (0/0).
 * - Varasuunnitelma: kaksivaiheinen render, kokonaismäärä printToFileAsync().numberOfPages → `knownTotalPages`.
 * - Ylä-/alatunniste: position: fixed + layout-taulukon thead/tfoot-välikkeet (toistuvat joka sivulla).
 * - Fontti: IBM Plex Sans ei upotettu → Arial-fallback (hyväksytty, avoin kohta Eemilille).
 */

export const PDF_HEADER_HEIGHT_MM = 30;
export const PDF_FOOTER_HEIGHT_MM = 16;
export const PDF_DEFAULT_ACCENT = '#C90000';

export type PdfStyleOptions = {
  accentColor?: string;
  /** Kaksivaiheinen fallback: tunnettu sivumäärä korvaa counter(pages):n. */
  knownTotalPages?: number | null;
};

const HEX = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;

export function pageNumberContent(knownTotalPages?: number | null): string {
  const known =
    typeof knownTotalPages === 'number' && Number.isFinite(knownTotalPages) && knownTotalPages > 0
      ? Math.trunc(knownTotalPages)
      : null;
  return known ? `"Sivu " counter(page) "/${known}"` : `"Sivu " counter(page) "/" counter(pages)`;
}

export function pdfStyles(options: PdfStyleOptions = {}): string {
  const accent = options.accentColor && HEX.test(options.accentColor) ? options.accentColor : PDF_DEFAULT_ACCENT;
  return `
  @page {
    size: A4 portrait;
    margin: 10mm 14mm 12mm 14mm;
    @bottom-right {
      content: ${pageNumberContent(options.knownTotalPages)};
      font-family: 'IBM Plex Sans', Arial, Helvetica, sans-serif;
      font-style: italic;
      font-size: 8pt;
      color: #000;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', Arial, Helvetica, sans-serif; color: #000; font-size: 11pt; line-height: 1.3; }
  .header, .footer { position: fixed; left: 0; right: 0; background: #fff; }
  .header { top: 0; height: ${PDF_HEADER_HEIGHT_MM}mm; display: flex; gap: 6mm; align-items: flex-start; border-bottom: 1px solid #000; padding-bottom: 2mm; }
  .header .logo-col { flex: 0 0 45mm; }
  .header .logo { max-width: 45mm; max-height: 14mm; width: auto; height: auto; }
  .header .customer, .header .offer { flex: 1; font-size: 9.5pt; }
  .header .customer .name { font-weight: 700; }
  .header .offer table { border-collapse: collapse; }
  .header .offer td { padding: 0 2mm 0 0; vertical-align: top; }
  .header .offer td.label { color: #333; }
  .footer { bottom: 0; height: ${PDF_FOOTER_HEIGHT_MM}mm; display: flex; gap: 6mm; border-top: 1px solid #000; padding-top: 2mm; font-size: 8pt; }
  .footer .col { flex: 1; text-align: left; }
  table.layout { width: 100%; border-collapse: collapse; }
  table.layout > thead td, table.layout > tfoot td, table.layout > tbody > tr > td { padding: 0; }
  .spacer-top { height: ${PDF_HEADER_HEIGHT_MM + 4}mm; }
  .spacer-bottom { height: ${PDF_FOOTER_HEIGHT_MM + 2}mm; }
  .spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 6mm; }
  .spec-card { border: 1px solid #ccc; border-top: 3px solid ${accent}; padding: 2.5mm 3mm; page-break-inside: avoid; break-inside: avoid; }
  .spec-card.full { grid-column: 1 / -1; }
  .spec-card h2 { margin: 0 0 1.5mm 0; font-size: 11pt; font-weight: 700; }
  .spec-card table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .spec-card td { padding: 0.6mm 0; vertical-align: top; }
  .spec-card td.value { text-align: right; padding-left: 3mm; white-space: nowrap; }
  .price-block { display: flex; gap: 12px; margin: 2mm 0 6mm 0; page-break-inside: avoid; break-inside: avoid; }
  .price-block .col { flex: 1; }
  .price-block table { width: 100%; border-collapse: collapse; }
  .price-block td { padding: 0.8mm 0; }
  .price-block td.value { text-align: right; white-space: nowrap; }
  .price-block tr.emphasis td { font-weight: 700; font-size: 12.5pt; border-top: 2px solid ${accent}; padding-top: 1.5mm; }
  .additional-info { page-break-inside: avoid; break-inside: avoid; }
  .additional-info h3 { margin: 0 0 1.5mm 0; font-size: 11pt; }
  .page-break { page-break-before: always; break-before: page; }
  .ktv-title { margin: 0 0 4mm 0; font-size: 14pt; }
  .ktv-page .price-block { max-width: 150mm; }
  .ktv-one-person { font-weight: 700; margin: 4mm 0 2mm 0; }
  .ktv-note { font-size: 9pt; color: #333; }
`;
}

/** Tarjouksen rivitaulukko ja osiot. Liitetään vain tarjous-HTML:ään, ei urakkakorttiin. */
export const offerDocumentCss = `
  .offer-rows { width: 100%; border-collapse: collapse; margin: 0 0 3mm 0; font-size: 10pt; }
  .offer-rows th { text-align: left; font-weight: 700; font-size: 9pt; border-bottom: 1px solid #000; padding: 1mm 1.5mm 1mm 0; }
  .offer-rows td { padding: 1mm 1.5mm 1mm 0; vertical-align: top; }
  .offer-rows th.num, .offer-rows td.num { text-align: right; white-space: nowrap; }
  .offer-rows tbody.offer-line, .offer-rows tr { break-inside: avoid; page-break-inside: avoid; }
  .offer-rows tr.offer-desc td { font-size: 9pt; color: #333; padding-bottom: 2mm; }
  .offer-delivery { margin: 1mm 0 4mm 0; }
  .offer-section { margin: 0 0 5mm 0; break-inside: avoid; page-break-inside: avoid; }
  .offer-section h2 { margin: 3mm 0 1.5mm 0; font-size: 12pt; }
  .offer-section p { margin: 0 0 1.5mm 0; }
  .offer-section ul { margin: 0 0 2mm 4mm; padding: 0; }
  .offer-section li { margin: 0; }
  .offer-vat { width: 100%; max-width: 140mm; border-collapse: collapse; margin: 2mm 0 6mm 0; break-inside: avoid; page-break-inside: avoid; }
  .offer-vat th, .offer-vat td { padding: 0.8mm 2mm 0.8mm 0; text-align: left; }
  .offer-vat th.num, .offer-vat td.num { text-align: right; white-space: nowrap; }
  .offer-vat th { border-bottom: 1px solid #000; font-size: 9pt; }
  .offer-seller { margin: 4mm 0; break-inside: avoid; page-break-inside: avoid; }
  .offer-seller h3 { margin: 0 0 1.5mm 0; font-size: 11pt; }
  .ktv-rate-sentence { margin: 0 0 3mm 0; }
`;
