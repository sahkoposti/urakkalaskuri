import { escapeHtml } from '@/src/core/pdf/escapeHtml';

import {
  DEFAULT_ATTACHMENT_PAGE_LAYOUT,
  imagesPerPage,
  type AttachmentPageLayout,
} from './attachmentPrintPlan';

export type AttachmentSectionImage = { dataUri: string; caption: string };
export type AttachmentSectionPdf = { name: string };

const SECTION_CSS = `<style>
  .liitteet h2 { margin: 0 0 3mm 0; font-size: 15pt; font-weight: 700; }
  .liite-pdf { margin: 0 0 4mm 0; padding: 0 0 0 5mm; }
  .liite-pdf li { margin: 0 0 1mm 0; }
  .liite-sivu + .liite-sivu { break-before: page; page-break-before: always; }
  .liite-kuva { margin: 0 0 4mm 0; break-inside: avoid; page-break-inside: avoid; }
  .liite-kuva img { display: block; width: 100%; object-fit: contain; }
  .liite-sivu.two .liite-kuva img { max-height: 105mm; }
  .liite-sivu.one .liite-kuva img { max-height: 220mm; }
  .liite-kuva figcaption { margin-top: 1mm; font-size: 11pt; }
</style>`;

function captionText(index: number, caption: string): string {
  const text = caption.trim();
  return text ? `Kuva ${index}. ${text}` : `Kuva ${index}`;
}

function figureHtml(index: number, image: AttachmentSectionImage): string {
  return `<figure class="liite-kuva"><img src="${escapeHtml(image.dataUri)}" alt="" /><figcaption>${escapeHtml(captionText(index, image.caption))}</figcaption></figure>`;
}

/**
 * Liitteet-osio uudelta sivulta. Tyhjä lista palauttaa tyhjän merkkijonon,
 * jotta kutsuja voi jättää dokumentin ennalleen.
 * PDF-sivuja ei upoteta: nimet listataan, sivut yhdistetään tulosteen perään.
 */
export function renderAttachmentSectionHtml(input: {
  images: readonly AttachmentSectionImage[];
  pdfs: readonly AttachmentSectionPdf[];
  layout?: AttachmentPageLayout;
}): string {
  if (input.images.length === 0 && input.pdfs.length === 0) return '';
  const layout = input.layout ?? DEFAULT_ATTACHMENT_PAGE_LAYOUT;
  const perPage = imagesPerPage(layout);
  const pageClass = layout === 'one_per_page' ? 'one' : 'two';
  const pdfList =
    input.pdfs.length > 0
      ? `<ul class="liite-pdf">${input.pdfs.map((pdf) => `<li>Liitteenä: ${escapeHtml(pdf.name)}</li>`).join('')}</ul>`
      : '';
  const pages: string[] = [];
  let imageIndex = 0;
  if (input.images.length === 0) {
    return `<section class="liitteet page-break">${SECTION_CSS}<h2>Liitteet</h2>${pdfList}</section>`;
  }
  for (let start = 0; start < input.images.length; start += perPage) {
    const figures = input.images.slice(start, start + perPage).map((image) => {
      imageIndex += 1;
      return figureHtml(imageIndex, image);
    });
    const head = pages.length === 0 ? `<h2>Liitteet</h2>${pdfList}` : '';
    pages.push(`<div class="liite-sivu ${pageClass}">${head}${figures.join('')}</div>`);
  }
  return `<section class="liitteet page-break">${SECTION_CSS}${pages.join('\n')}</section>`;
}

/** Liittää osion valmiin dokumentin runkoon. Tyhjä osio ei muuta HTML:ää. */
export function appendAttachmentSection(html: string, sectionHtml: string): string {
  if (!sectionHtml) return html;
  const marker = '</td></tr></tbody>';
  const at = html.lastIndexOf(marker);
  if (at === -1) return `${html}\n${sectionHtml}`;
  return `${html.slice(0, at)}${sectionHtml}\n${html.slice(at)}`;
}
