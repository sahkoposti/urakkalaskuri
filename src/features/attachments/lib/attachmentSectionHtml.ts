import { escapeHtml } from '@/src/core/pdf/escapeHtml';
import {
  PDF_A4_WIDTH_MM,
  PDF_HORIZONTAL_MARGIN_EXTRA_MM,
  PDF_OFFER_ACCENT_BAR_MM,
  PDF_OFFER_TEXT_INSET_X_MM,
  PDF_PAGE_MARGIN_LEFT_MM,
  PDF_PAGE_MARGIN_RIGHT_MM,
  PDF_USABLE_BODY_MM,
} from '@/src/core/pdf/pdfStyles';

import {
  DEFAULT_ATTACHMENT_PAGE_LAYOUT,
  imagesPerPage,
  type AttachmentSectionLayout,
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
/**
 * Kaksi kuvaa sivulla. 80 mm mahtui Chromeen mutta oli laitteella liian korkea.
 * 72 mm jättää kuvatekstin ja välin alle käytettävän korkeuden.
 */
export const ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM = 72;
/** Kahden kuvan päätös vaatii tämän verran tyhjää käytettävän korkeuden alle. */
export const OFFER_TWO_UP_CLEARANCE_MM = 8;
/** Yksi iso kuva sivulla. Yksi kuva + kuvateksti + otsikko mahtuu 223 mm:iin. */
export const ATTACHMENT_IMAGE_MAX_HEIGHT_ONE_MM = 175;
/** Kortin ruudukko: kaksi saraketta, neljä kuvaa sivulla. */
export const ATTACHMENT_CARD_GRID_GAP_MM = 4;
export const ATTACHMENT_CARD_CAPTION_LINES = 2;
/** Kortin kuvan enimmäiskorkeus. Kaksi riviä + otsikko mahtuu 223 mm:iin, kuvateksti katkaistaan. */
export const ATTACHMENT_CARD_IMAGE_MAX_HEIGHT_MM = 86;

/** Kortin sisältöleveys sivulisän jälkeen. */
export function attachmentCardContentWidthMm(): number {
  return (
    PDF_A4_WIDTH_MM -
    (PDF_PAGE_MARGIN_LEFT_MM + PDF_HORIZONTAL_MARGIN_EXTRA_MM) -
    (PDF_PAGE_MARGIN_RIGHT_MM + PDF_HORIZONTAL_MARGIN_EXTRA_MM)
  );
}

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

/**
 * Tarjouksen kuvat: kaksi sivulla, kun kaksi kuvaa ja kuvateksti mahtuvat selvästi.
 * Muuten yksi kuva sivulla. Kortin ruudukko ei käytä tätä.
 */
export function offerAttachmentLayoutForHeight(
  imageMaxMm: number,
  extraPt = 1,
): 'two_per_page' | 'one_per_page' {
  const block = imageMaxMm + attachmentCaptionBlockMaxMm(extraPt);
  const budget = attachmentPairUsableMm(extraPt) - OFFER_TWO_UP_CLEARANCE_MM;
  return block * 2 <= budget ? 'two_per_page' : 'one_per_page';
}

/** Tarjouksen tekstileveys, jolle kuvateksti rivittyy. */
export function offerCaptionContentWidthMm(): number {
  const marginRight = PDF_OFFER_TEXT_INSET_X_MM + PDF_HORIZONTAL_MARGIN_EXTRA_MM;
  const marginLeft = PDF_OFFER_ACCENT_BAR_MM;
  const inset = PDF_OFFER_TEXT_INSET_X_MM + PDF_HORIZONTAL_MARGIN_EXTRA_MM - PDF_OFFER_ACCENT_BAR_MM;
  return PDF_A4_WIDTH_MM - marginRight - marginLeft - inset;
}

/**
 * Kuvatekstin rivimäärä. Merkki lasketaan em-levyisenä, koska fontin oikeita
 * mittoja ei mitata. Tämä on yläraja rivimäärälle, ei laitteen mittaus.
 */
export function captionLineCount(caption: string, extraPt = 1, index = 1): number {
  const prefix = `Kuva ${index}. `;
  const text = caption.trim() ? `${prefix}${caption.trim()}` : `Kuva ${index}`;
  const charMm = (ATTACHMENT_CAPTION_PT + extraPt) * MM_PER_PT;
  const perLine = Math.max(1, Math.floor(offerCaptionContentWidthMm() / charMm));
  let lines = 0;
  for (const part of text.split('\n')) {
    lines += Math.max(1, Math.ceil([...part].length / perLine));
  }
  return lines;
}

function attachmentCaptionBlockMm(lines: number, extraPt: number): number {
  const text = lineBoxMm(ATTACHMENT_CAPTION_PT + extraPt, lines);
  return text + ATTACHMENT_CAPTION_MARGIN_TOP_MM + ATTACHMENT_FIGURE_MARGIN_BOTTOM_MM;
}

/**
 * Tarjouksen asettelu kuvatekstien mukaan. Yli kolmen rivin kuvateksti tai
 * liian korkea kuva+teksti-blokki on yksi kuva sivulla. Päätös on taiton
 * laskentaa, ei ajon aikana mitattu korkeus.
 */
export function offerAttachmentLayoutForCaptions(
  captions: readonly string[],
  options?: { extraPt?: number; imageMaxMm?: number },
): 'two_per_page' | 'one_per_page' {
  const extraPt = options?.extraPt ?? 1;
  const imageMaxMm = options?.imageMaxMm ?? ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM;
  const counts = captions.map((caption, index) => captionLineCount(caption, extraPt, index + 1));
  const longest = counts.reduce((max, count) => Math.max(max, count), 1);
  if (longest > ATTACHMENT_CAPTION_LINE_BUDGET) return 'one_per_page';
  const block = imageMaxMm + attachmentCaptionBlockMm(longest, extraPt);
  const budget = attachmentPairUsableMm(extraPt) - OFFER_TWO_UP_CLEARANCE_MM;
  return block * 2 <= budget ? 'two_per_page' : 'one_per_page';
}

export function resolveOfferAttachmentLayout(
  captions: readonly string[] = [],
  extraPt = 1,
): 'two_per_page' | 'one_per_page' {
  return offerAttachmentLayoutForCaptions(captions, { extraPt });
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
  .liite-sivu.card { display: grid; grid-template-columns: 1fr 1fr; column-gap: ${ATTACHMENT_CARD_GRID_GAP_MM}mm; row-gap: ${ATTACHMENT_CARD_GRID_GAP_MM}mm; align-content: start; overflow: visible; max-height: none; }
  .liite-sivu.card > h2, .liite-sivu.card > .liite-pdf { grid-column: 1 / -1; }
  .liite-sivu.card .liite-kuva { margin: 0; min-width: 0; break-inside: avoid; page-break-inside: avoid; }
  .liite-sivu.card .liite-kuva img { max-height: ${ATTACHMENT_CARD_IMAGE_MAX_HEIGHT_MM}mm; }
  .liite-sivu.card figcaption { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${ATTACHMENT_CARD_CAPTION_LINES}; overflow: hidden; max-height: ${lineBoxMm(captionPt, ATTACHMENT_CARD_CAPTION_LINES).toFixed(2)}mm; }
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
  layout?: AttachmentSectionLayout;
  fontExtraPt?: number;
}): string {
  if (input.images.length === 0 && input.pdfs.length === 0) return '';
  const layout = input.layout ?? DEFAULT_ATTACHMENT_PAGE_LAYOUT;
  const perPage = imagesPerPage(layout);
  const pageClass = layout === 'card_grid' ? 'card' : layout === 'one_per_page' ? 'one' : 'two';
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
