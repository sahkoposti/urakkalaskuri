/**
 * T1-spike: 3-sivuinen testi-HTML, jolla tarkistetaan laitteella
 *  1) logo näkyy, 2) ylä- ja alatunniste toistuvat joka sivulla,
 *  3) toimiiko `counter(pages)` (Sivu n/m) Android WebView -tulostuksessa.
 * Väliaikainen: poistetaan T10:ssä. Ei asiakastietoja, vain testitekstiä.
 */
export type PdfSpikeHtmlOptions = {
  logoDataUri?: string | null;
  pageCount?: number;
  /** Kaksivaiheinen varasuunnitelma: jos tiedossa (printToFileAsync.numberOfPages), näytetään staattisena. */
  knownTotalPages?: number | null;
};

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HEADER_H = 22; // mm
const FOOTER_H = 16; // mm

export function buildPdfSpikeHtml(options: PdfSpikeHtmlOptions = {}): string {
  const pageCount = Math.max(1, Math.trunc(options.pageCount ?? 3));
  const logo = options.logoDataUri
    ? `<img class="logo" src="${escapeHtmlText(options.logoDataUri)}" alt="ColoRajaton" />`
    : '<div class="logo-missing">LOGO PUUTTUU</div>';
  const known =
    typeof options.knownTotalPages === 'number' && options.knownTotalPages > 0
      ? Math.trunc(options.knownTotalPages)
      : null;

  const sections: string[] = [];
  for (let i = 1; i <= pageCount; i += 1) {
    const filler = Array.from(
      { length: 6 },
      (_, k) => `<p>Testikappale ${i}.${k + 1}. Tämä teksti täyttää sivua, jotta sivunvaihto ja toistuvat tunnisteet näkyvät. Ääkköset: ä ö å Ä Ö Å.</p>`,
    ).join('\n');
    sections.push(
      `<section class="test-page${i > 1 ? ' break' : ''}">
  <h1>Testisivu ${i} / ${pageCount}</h1>
  ${known ? `<p class="known">Kaksivaiheinen arvo: Sivu ${i}/${known}</p>` : ''}
  ${filler}
</section>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="fi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  /*
   * Ylä-/alatunnisteen toisto: position: fixed (top: 0 / bottom: 0 sivun sisältöalueella)
   * + taulukon thead/tfoot-välikkeet, jotka varaavat tilan joka sivulla.
   * Sivunumero A: @page-marginaalilaatikko. B: sama laskuri fixed-footerissa (vertailu).
   */
  @page {
    size: A4 portrait;
    margin: 10mm 14mm 12mm 14mm;
    @bottom-right {
      content: "A: Sivu " counter(page) "/" counter(pages);
      font-style: italic;
      font-size: 8pt;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans', Arial, sans-serif; color: #000; font-size: 10pt; }
  .header, .footer { position: fixed; left: 0; right: 0; background: #fff; }
  .header { top: 0; height: ${HEADER_H}mm; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #000; }
  .logo { height: 12mm; width: auto; }
  .logo-missing { color: #c00; font-weight: bold; }
  .footer { bottom: 0; height: ${FOOTER_H}mm; display: flex; justify-content: space-between; border-top: 1px solid #000; font-size: 8pt; padding-top: 2mm; }
  .footer .col { flex: 1; }
  .pageno::after { content: "B: Sivu " counter(page) "/" counter(pages); font-style: italic; }
  table.layout { width: 100%; border-collapse: collapse; }
  .spacer-top { height: ${HEADER_H + 4}mm; }
  .spacer-bottom { height: ${FOOTER_H + 2}mm; }
  .break { page-break-before: always; break-before: page; }
  .known { color: #555; font-style: italic; }
</style>
</head>
<body>
<div class="header">${logo}<div>PDF-testi (T1)</div></div>
<div class="footer">
  <div class="col">Vasen palsta<br/>Testiyritys</div>
  <div class="col">Keskipalsta<br/>esimerkki.invalid</div>
  <div class="col" style="text-align:right">Oikea palsta<br/><span class="pageno"></span></div>
</div>
<table class="layout">
<thead><tr><td class="spacer-top"></td></tr></thead>
<tfoot><tr><td class="spacer-bottom"></td></tr></tfoot>
<tbody><tr><td>
${sections.join('\n')}
</td></tr></tbody>
</table>
</body>
</html>`;
}
