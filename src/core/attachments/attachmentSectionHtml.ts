import { escapeHtml } from '@/src/core/pdf/escapeHtml';
import { PDF_USABLE_BODY_MM } from '@/src/core/pdf/pdfStyles';

import {
  DEFAULT_ATTACHMENT_PAGE_LAYOUT,
  imagesPerPage,
  type AttachmentPageLayout,
} from './attachmentPrintPlan';

export type AttachmentSectionImage = { dataUri: string; caption: string };
export type AttachmentSectionPdf = { name: string };

const MM_PER_PT = 25.4 / 72;

/** Osion otsikko. Nykyinen tarjousfontti (v1.3.1:n +1 pt). */
export const ATTACHMENT_HEADING_PT = 15;
/** Kuvateksti. */
export const ATTACHMENT_CAPTION_PT = 11;
export const ATTACHMENT_LINE_HEIGHT = 1.3;
export const ATTACHMENT_HEADING_MARGIN_BOTTOM_MM = 3;
export const ATTACHMENT_CAPTION_MARGIN_TOP_MM = 1;
export const ATTACHMENT_FIGURE_MARGIN_BOTTOM_MM = 4;
/**
 * 120 merkin kuvateksti ja etuliite "Kuva N. " rivittyvät 2–3 riviksi
 * tarjouksen tekstileveydellä. Budjetti on kolme riviä.
 */
export const ATTACHMENT_CAPTION_LINE_BUDGET = 3;
/**
 * Chromen taittoon jäävä väli viivamallin ja sivunvaihdon välissä.
 * 82 mm ei mahtunut kahdelle kuvalle, 80 mm mahtui.
 */
export const ATTACHMENT_PAGE_SLACK_MM = 6;
/** Kaksi kuvaa sivulla. Mitattu: 80 mm mahtuu, 82 mm ei (+1 pt, 120 merkkiä). */
export const ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM = 80;
/** Yksi iso kuva sivulla. Yksi kuva + kuvateksti + otsikko mahtuu 223 mm:iin. */
export const ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM = 175;

function lineBoxMm(pt: number, lines: number): number {
  return lines * pt * ATTACHMENT_LINE_HEIGHT * MM_PER_PT;
}

/** Kuvateksti + kuvan alamarginaali. Oletus on +1 pt, tiukempi tapaus. */
export function attachmentCaptionBlockMaxMm(extraPt = 1): number {
  const text = lineBoxMm(ATTACHMENT_CAPTION_PT + extraPt, ATTACHMENT_CAPTION_LINE_BUDGET);
  return text + ATTACHMENT_CAPTION_MARGIN_TOP_MM + ATTACHMENT_FIGURE_MARGIN_BOTTOM_MM;
}

/**
 * Ensimmäisen liitesivun korkeus kahdelle kuvalle: käytettävissä oleva
 * 223 mm miinus otsikko ja taiton väli.
 */
export function attachmentPairUsableMm(extraPt = 1): number {
  const heading =
    lineBoxMm(ATTACHMENT_HEADING_PT + extraPt, 1) + ATTACHMENT_HEADING_MARGIN_BOTTOM_MM;
  return PDF_USABLE_BODY_MM - heading - ATTACHMENT_PAGE_SLACK_MM;
}

function sectionCss(extraPt: number): string {
  const headingPt = ATTACHMENT_HEADING_PT + extraPt;
  const captionPt = ATTACHMENT_CAPTION_PT + extraPt;
  return `<style>
  .liitteet h2 { margin: 0 0 ${ATTACHMENT_HEADING_MARGIN_BOTTOM_MM}mm 0; font-size: ${headingPt}pt; line-height: ${ATTACHMENT_LINE_HEIGHT}; font-weight: 700; break-after: avoid; page-break-after: avoid; }
  .liite-pdf { margin: 0 0 4mm 0; padding: 0 0 0 5mm; }
  .liite-pdf li { margin: 0 0 1mm 0; overflow-wrap: anywhere; }
  .liite-sivu { max-height: ${PDF_USABLE_BODY_MM}mm; overflow: hidden; }
  .liite-sivu + .liite-sivu { break-before: page; page-break-before: always; }
  .liite-kuva { margin: 0 0 ${ATTACHMENT_FIGURE_MARGIN_BOTTOM_MM}mm 0; break-inside: avoid; page-break-inside: avoid; }
  .liite-kuva img { display: block; width: 100%; height: auto; object-fit: contain; }
  .liite-sivu.two .liite-kuva img { max-height: ${ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM}mm; }
  .liite-sivu.one .liite-kuva img { max-height: ${ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM}mm; }
  .liite-kuva figcaption { margin-top: ${ATTACHMENT_CAPTION_MARGIN_TOP_MM}mm; font-size: ${captionPt}pt; line-height: ${ATTACHMENT_LINE_HEIGHT}; overflow-wrap: anywhere; }
</style>`;
}

function captionText(index: number, caption: string): string {
  const text = caption.trim();
  return text ? `Kuva ${index}. ${text}` : `Kuva ${index}`;
}

function figureHtml(index: number, image: AttachmentSectionImage): string {
  return `<figure class="liite-kuva"><img src="${escapeHtml(image.dataUri)}" alt="" /><figcaption>${escapeHtml(captionText(index, image.caption))}</figcaption></figure>`;
}

function fontExtra(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.trunc(value);
}

/**
 * Liitteet-osio uudelta sivulta. Tyhjä lista palauttaa tyhjän merkkijonon,
 * jotta kutsuja voi jättää dokumentin ennalleen.
 * PDF-sivuja ei upoteta: nimet listataan, sivut yhdistetään tulosteen perään.
 * `fontExtraPt` kasvattaa vain otsikon ja kuvatekstin (testin +1 pt). Kuvan korkeus ei muutu.
 */
export function renderAttachmentSectionHtml(input: {
  images: readonly AttachmentSectionImage[];
  pdfs: readonly AttachmentSectionPdf[];
  layout?: AttachmentPageLayout;
  fontExtraPt?: number;
}): string {
  if (input.images.length === 0 && input.pdfs.length === 0) return '';
  const layout = input.layout ?? DEFAULT_ATTACHMENT_PAGE_LAYOUT;
  const perPage = imagesPerPage(layout);
  const pageClass = layout === 'one_per_page' ? 'one' : 'two';
  const css = sectionCss(fontExtra(input.fontExtraPt));
  const pdfList =
    input.pdfs.length > 0
      ? `<ul class="liite-pdf">${input.pdfs.map((pdf) => `<li>Liitteenä: ${escapeHtml(pdf.name)}</li>`).join('')}</ul>`
      : '';
  const pages: string[] = [];
  let imageIndex = 0;
  if (input.images.length === 0) {
    return `<section class="liitteet page-break">${css}<h2>Liitteet</h2>${pdfList}</section>`;
  }
  for (let start = 0; start < input.images.length; start += perPage) {
    const figures = input.images.slice(start, start + perPage).map((image) => {
      imageIndex += 1;
      return figureHtml(imageIndex, image);
    });
    const head = pages.length === 0 ? `<h2>Liitteet</h2>${pdfList}` : '';
    pages.push(`<div class="liite-sivu ${pageClass}">${head}${figures.join('')}</div>`);
  }
  return `<section class="liitteet page-break">${css}${pages.join('\n')}</section>`;
}

/** Liittää osion valmiin dokumentin runkoon. Tyhjä osio ei muuta HTML:ää. */
export function appendAttachmentSection(html: string, sectionHtml: string): string {
  if (!sectionHtml) return html;
  const marker = '</td></tr></tbody>';
  const at = html.lastIndexOf(marker);
  if (at === -1) return `${html}\n${sectionHtml}`;
  return `${html.slice(0, at)}${sectionHtml}\n${html.slice(at)}`;
}
