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
/** Leipäteksti. PDF-fonttikoot ovat pisteinä, kukin yhden pisteen aiempaa suurempi. */
export const PDF_BODY_FONT_PT = 12;
/** @page-marginaalit. Urakkakortti käyttää näitä sellaisenaan. */
export const PDF_PAGE_MARGIN_TOP_MM = 10;
export const PDF_PAGE_MARGIN_RIGHT_MM = 14;
export const PDF_PAGE_MARGIN_BOTTOM_MM = 12;
export const PDF_PAGE_MARGIN_LEFT_MM = 14;
/** Tarjouksen tekstialueen sisennys paperin reunasta, vasen ja oikea. */
export const PDF_OFFER_TEXT_INSET_X_MM = 18;
/** Tarjouksen vasen korostus. Sama väri kuin Loppusumman viiva. */
export const PDF_OFFER_ACCENT_BAR_MM = 2.5;

export type PdfStyleOptions = {
  accentColor?: string;
  /** Kaksivaiheinen fallback: tunnettu sivumäärä korvaa counter(pages):n. */
  knownTotalPages?: number | null;
  /** Vain tarjous. Urakkakortti ei saa palkkia. */
  offerAccentBar?: boolean;
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
  const offerBar = options.offerAccentBar === true;
  const marginRight = offerBar ? PDF_OFFER_TEXT_INSET_X_MM : PDF_PAGE_MARGIN_RIGHT_MM;
  const marginLeft = offerBar ? PDF_OFFER_ACCENT_BAR_MM : PDF_PAGE_MARGIN_LEFT_MM;
  const offerInsetLeft = PDF_OFFER_TEXT_INSET_X_MM - PDF_OFFER_ACCENT_BAR_MM;
  const accentBoxes = offerBar
    ? `
    @top-left-corner { content: ""; background: ${accent}; }
    @left-top { content: ""; background: ${accent}; }
    @left-middle { content: ""; background: ${accent}; }
    @left-bottom { content: ""; background: ${accent}; }
    @bottom-left-corner { content: ""; background: ${accent}; }`
    : '';
  return `
  @page {
    size: A4 portrait;
    margin: ${PDF_PAGE_MARGIN_TOP_MM}mm ${marginRight}mm ${PDF_PAGE_MARGIN_BOTTOM_MM}mm ${marginLeft}mm;
    @bottom-right {
      content: ${pageNumberContent(options.knownTotalPages)};
      font-family: 'IBM Plex Sans', Arial, Helvetica, sans-serif;
      font-style: italic;
      font-size: 9pt;
      color: #000;
    }${accentBoxes}
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', Arial, Helvetica, sans-serif; color: #000; font-size: ${PDF_BODY_FONT_PT}pt; line-height: 1.3; }
  .header, .footer { position: fixed; left: 0; right: 0; background: #fff; }
  .header { top: 0; height: ${PDF_HEADER_HEIGHT_MM}mm; display: flex; gap: 6mm; align-items: flex-start; border-bottom: 1px solid #000; padding-bottom: 2mm; }
  .header .logo-col { flex: 0 0 45mm; }
  .header .logo { max-width: 45mm; max-height: 14mm; width: auto; height: auto; }
  .header .customer, .header .offer { flex: 1; font-size: 10.5pt; }
  .header .customer .name { font-weight: 700; }
  .header .offer table { border-collapse: collapse; }
  .header .offer td { padding: 0 2mm 0 0; vertical-align: top; }
  .header .offer td.label { color: #333; }
  .footer { bottom: 0; height: ${PDF_FOOTER_HEIGHT_MM}mm; display: flex; gap: 6mm; border-top: 1px solid #000; padding-top: 2mm; font-size: 9pt; }
  .footer .col { flex: 1; text-align: left; }
  table.layout { width: 100%; border-collapse: collapse; }
  table.layout > thead td, table.layout > tfoot td, table.layout > tbody > tr > td { padding: 0; }
  .spacer-top { height: ${PDF_HEADER_HEIGHT_MM + 4}mm; }
  .spacer-bottom { height: ${PDF_FOOTER_HEIGHT_MM + 2}mm; }
  .spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 6mm; }
  .spec-card { border: 1px solid #ccc; border-top: 3px solid ${accent}; padding: 2.5mm 3mm; page-break-inside: avoid; break-inside: avoid; }
  .spec-card.full { grid-column: 1 / -1; }
  .spec-card h2 { margin: 0 0 1.5mm 0; font-size: 12pt; font-weight: 700; }
  .spec-card table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .spec-card td { padding: 0.6mm 0; vertical-align: top; }
  .spec-card td.value { text-align: right; padding-left: 3mm; white-space: nowrap; }
  .price-block { display: flex; gap: 12px; margin: 2mm 0 6mm 0; page-break-inside: avoid; break-inside: avoid; }
  .price-block .col { flex: 1; }
  .price-block table { width: 100%; border-collapse: collapse; }
  .price-block td { padding: 0.8mm 0; }
  .price-block td.value { text-align: right; white-space: nowrap; }
  .price-block tr.emphasis td { font-weight: 700; font-size: 13.5pt; border-top: 2px solid ${accent}; padding-top: 1.5mm; }
  .additional-info h3 { margin: 0 0 1.5mm 0; font-size: 12pt; break-after: avoid; page-break-after: avoid; }
  .page-break { page-break-before: always; break-before: page; }
  .ktv-title { margin: 0 0 2mm 0; font-size: 15pt; }
  .ktv-rate-sentence { margin: 0 0 5mm 0; font-size: 11pt; color: #333; }
  .ktv-block { margin: 0 0 5mm 0; break-inside: avoid; page-break-inside: avoid; }
  table.ktv-table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  table.ktv-table col.c-basis { width: 52mm; }
  table.ktv-table col.c-amount { width: 34mm; }
  table.ktv-table th { font-size: 9pt; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #555; border-bottom: 0.25mm solid #ccc; text-align: left; padding: 0.6mm 1.5mm 0.6mm 0; }
  table.ktv-table th.num { text-align: right; padding-right: 0; }
  table.ktv-table td { font-size: 11.5pt; padding: 1.2mm 1.5mm 1.2mm 0; border-bottom: 0.2mm solid #eee; vertical-align: baseline; }
  table.ktv-table td.basis { font-size: 10pt; color: #555; text-align: right; white-space: nowrap; }
  table.ktv-table td.num { text-align: right; white-space: nowrap; padding-right: 0; }
  table.ktv-table tr.sub td { padding-left: 5mm; }
  table.ktv-table tr.sub td.num, table.ktv-table tr.sub td.basis { padding-left: 0; }
  table.ktv-table tr.minor td { color: #444; }
  table.ktv-table tr.result td { font-weight: 700; border-bottom: none; border-top: 0.4mm solid #000; }
  .ktv-hint { font-size: 10pt; color: #666; margin: 0 0 5mm 0; }
  .ktv-note { font-size: 10pt; color: #333; margin: 0; }${offerBar ? `
  body.doc-offer { padding-left: ${offerInsetLeft}mm; }
  body.doc-offer .header, body.doc-offer .footer { left: ${offerInsetLeft}mm; }` : ''}
`;
}

/** Tarjouksen rivitaulukko ja osiot. Liitetään vain tarjous-HTML:ään, ei urakkakorttiin. */
export const offerDocumentCss = `
  .price-block.offer-totals { justify-content: flex-end; }
  .price-block.offer-totals .col { flex: 0 1 118mm; }
  .offer-doc-title { margin: 0 0 4mm 0; font-size: 15pt; font-weight: 700; }
  .offer-delivery { margin: 1mm 0 4mm 0; }
  .offer-vat { width: 100%; border-collapse: collapse; margin: 0 0 3mm 0; break-inside: avoid; page-break-inside: avoid; }
  .offer-vat tr { break-inside: avoid; page-break-inside: avoid; }
  .offer-vat th, .offer-vat td { padding: 0.8mm 2mm 0.8mm 0; text-align: left; }
  .offer-vat th.num, .offer-vat td.num { text-align: right; white-space: nowrap; }
  .offer-vat th { border-bottom: 1px solid #000; font-size: 10pt; }
  .offer-sign { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12mm; width: 100%; margin: 6mm 0 4mm 0; break-inside: avoid; page-break-inside: avoid; }
  .offer-sign-accept { grid-column: 1 / -1; margin: 0 0 3mm 0; }
  .offer-sign-role { margin: 0 0 1.5mm 0; font-weight: 700; }
  .offer-sign-name { min-width: 0; }
  .offer-sign-pen { break-inside: avoid; page-break-inside: avoid; }
  .offer-sign-detail { margin: 0 0 1mm 0; }
  .offer-sign-label { margin: 3mm 0 0 0; }
  .offer-sign-line { height: 10mm; border-bottom: 1px solid #000; margin: 0 0 1mm 0; break-inside: avoid; page-break-inside: avoid; }
  table.offer-cols-head, table.offer-line-heading { width: 100%; table-layout: fixed; border-collapse: collapse; }
  table.offer-cols-head { margin: 3mm 0 0 0; break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
  table.offer-line-heading { display: table; margin: 0 0 2mm 0; break-inside: avoid; page-break-inside: avoid; }
  table.offer-cols-head .c-qty, table.offer-line-heading .c-qty { width: 18mm; }
  table.offer-cols-head .c-unit, table.offer-line-heading .c-unit { width: 16mm; }
  table.offer-cols-head .c-unitprice, table.offer-line-heading .c-unitprice { width: 28mm; }
  table.offer-cols-head .c-vat, table.offer-line-heading .c-vat { width: 26mm; }
  table.offer-cols-head .c-total, table.offer-line-heading .c-total { width: 32mm; }
  table.offer-cols-head th, table.offer-cols-head td, table.offer-line-heading th, table.offer-line-heading td { padding: 0.6mm 1.5mm 0.6mm 0; vertical-align: baseline; text-align: left; }
  table.offer-cols-head th.num, table.offer-cols-head td.num, table.offer-line-heading th.num, table.offer-line-heading td.num { text-align: right; white-space: nowrap; }
  table.offer-cols-head th {
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #555;
    border-bottom: 0.25mm solid #ccc;
  }
  table.offer-line-heading td { border-bottom: 0.2mm solid #eee; padding-top: 1.2mm; padding-bottom: 1.2mm; }
  table.offer-line-heading td.offer-line-title { font-weight: 700; font-size: 13pt; color: #000; }
  table.offer-line-heading .offer-line-vat { font-size: 11pt; font-weight: 400; }
  .offer-section { margin: 0 0 4mm 0; }
  .offer-section .doc-fields td { line-height: 1.45; padding: 1mm 2mm 1mm 0; }
  .offer-section .doc-group { margin: 0 0 2.5mm 0; }
  .header { align-items: flex-start; }
  .header .offer td { line-height: 1.35; vertical-align: baseline; }
  .price-block.offer-totals { margin: 4mm 0 5mm 0; }
`;
