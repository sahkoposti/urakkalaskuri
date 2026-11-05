import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { pageNumberContent } from '../src/core/pdf/pdfStyles';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import {
  ATTACHMENT_IMAGE_JPEG_QUALITY,
  ATTACHMENT_IMAGE_MAX_LONG_SIDE_PX,
  ATTACHMENT_IMAGE_SECTION_WARN_BYTES,
  ATTACHMENT_MAX_IMAGES_PER_PDF,
  attachmentDisplayName,
  attachmentMatchesDestination,
  attachmentsForDestination,
  capAttachmentImages,
  estimateImageSectionBytes,
  imageResizePlan,
  imageSectionExceedsWarning,
  imagesPerPage,
  splitAttachments,
} from '../src/core/attachments/attachmentPrintPlan';
import {
  ATTACHMENT_IMAGE_SECTION_TOO_LARGE_MESSAGE,
  attachmentImageMissingMessage,
  attachmentImagesCappedMessage,
  attachmentPdfMissingMessage,
} from '../src/core/attachments/attachmentMessages';
import { appendAttachmentSection, renderAttachmentSectionHtml } from '../src/core/attachments/attachmentSectionHtml';
import { prepareAttachmentPrint } from '../src/core/attachments/prepareAttachmentPrint';
import type { Attachment } from '../src/core/attachments/types';
import { input, record } from './pdfFixtures';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function attachment(partial: Partial<Attachment> & Pick<Attachment, 'id'>): Attachment {
  return {
    calculationId: 'c1',
    kind: 'image',
    destination: 'offer',
    caption: '',
    fileRelPath: `attachments/c1/${partial.id}.jpg`,
    mime: 'image/jpeg',
    sizeBytes: 100,
    width: 100,
    height: 80,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('attachment print plan', () => {
  const items = [
    attachment({ id: 'none', destination: 'none', sortOrder: 0 }),
    attachment({ id: 'card', destination: 'card', kind: 'pdf', sortOrder: 1, caption: 'Kortti' }),
    attachment({ id: 'both-late', destination: 'both', sortOrder: 3, caption: 'Molemmat' }),
    attachment({ id: 'offer', destination: 'offer', sortOrder: 2, caption: 'Tarjous' }),
  ];

  it('keeps offer and both for the offer, card and both for the card, in sort order', () => {
    expect(attachmentsForDestination(items, 'offer').map((item) => item.id)).toEqual(['offer', 'both-late']);
    expect(attachmentsForDestination(items, 'card').map((item) => item.id)).toEqual(['card', 'both-late']);
    expect(attachmentMatchesDestination('none', 'offer')).toBe(false);
    expect(attachmentMatchesDestination('none', 'card')).toBe(false);
    const offer = splitAttachments(attachmentsForDestination(items, 'offer'));
    expect(offer.images.map((item) => item.id)).toEqual(['offer', 'both-late']);
    expect(offer.pdfs).toEqual([]);
    const card = splitAttachments(attachmentsForDestination(items, 'card'));
    expect(card.pdfs.map((item) => item.id)).toEqual(['card']);
    expect(card.images.map((item) => item.id)).toEqual(['both-late']);
  });

  it('breaks a tie on sort order with createdAt and id', () => {
    const tied = [
      attachment({ id: 'b', sortOrder: 1, createdAt: '2026-02-01T00:00:00.000Z' }),
      attachment({ id: 'a', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
      attachment({ id: 'c', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    expect(attachmentsForDestination(tied, 'offer').map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });

  it('plans a longest side of 1600 px at quality 0.7 and never upscales', () => {
    expect(imageResizePlan(100, 100)).toEqual({
      width: 100,
      height: 100,
      quality: ATTACHMENT_IMAGE_JPEG_QUALITY,
      resized: false,
    });
    expect(imageResizePlan(ATTACHMENT_IMAGE_MAX_LONG_SIDE_PX, 900)).toEqual({
      width: 1600,
      height: 900,
      quality: 0.7,
      resized: false,
    });
    expect(imageResizePlan(3200, 1600)).toEqual({ width: 1600, height: 800, quality: 0.7, resized: true });
    expect(imageResizePlan(800, 3200)).toEqual({ width: 400, height: 1600, quality: 0.7, resized: true });
    expect(imageResizePlan(1601, 900)).toEqual({ width: 1600, height: 899, quality: 0.7, resized: true });
    expect(imageResizePlan(0, 10)).toBeNull();
    expect(imageResizePlan(Number.NaN, 10)).toBeNull();
    expect(imageResizePlan(-1, 100)).toBeNull();
    expect(imagesPerPage('two_per_page')).toBe(2);
    expect(imagesPerPage('one_per_page')).toBe(1);
    expect(imagesPerPage()).toBe(2);
  });

  it('estimates base64 at 4/3 and warns only above 15 MB', () => {
    expect(estimateImageSectionBytes([1000, 500])).toBe(Math.ceil((1500 * 4) / 3));
    expect(estimateImageSectionBytes([-5, Number.NaN, 0])).toBe(0);
    const exactRaw = (ATTACHMENT_IMAGE_SECTION_WARN_BYTES * 3) / 4;
    expect(estimateImageSectionBytes([exactRaw])).toBe(ATTACHMENT_IMAGE_SECTION_WARN_BYTES);
    expect(imageSectionExceedsWarning(estimateImageSectionBytes([exactRaw]))).toBe(false);
    expect(imageSectionExceedsWarning(estimateImageSectionBytes([exactRaw + 1]))).toBe(true);
  });

  it('caps images at 20 and reports the rest', () => {
    const images = Array.from({ length: 21 }, (_, index) => index);
    const capped = capAttachmentImages(images);
    expect(capped.kept).toHaveLength(ATTACHMENT_MAX_IMAGES_PER_PDF);
    expect(capped.skipped).toEqual([20]);
    expect(attachmentImagesCappedMessage(1)).toBe(
      'Yksi kuva jätettiin pois. Tarjoukseen mahtuu enintään 20 kuvaa.',
    );
    expect(attachmentDisplayName(attachment({ id: 'x', caption: '  Julkisivu  ' }))).toBe('Julkisivu');
    expect(attachmentDisplayName(attachment({ id: 'x', caption: '   ' }))).toBe('x.jpg');
  });
});

describe('attachment section html', () => {
  const images = (count: number, caption = '') =>
    Array.from({ length: count }, (_, index) => ({ dataUri: PNG, caption: caption || `Kuva-aineisto ${index + 1}` }));

  it('lays out two images per page by default and one when asked', () => {
    const two = renderAttachmentSectionHtml({ images: images(5), pdfs: [] });
    expect(two.match(/class="liite-sivu two"/g)).toHaveLength(3);
    expect(two).toContain('Kuva 1. Kuva-aineisto 1');
    expect(two).toContain('Kuva 5. Kuva-aineisto 5');
    expect(two).not.toContain('Kuva 6');
    expect(two.indexOf('<h2>Liitteet</h2>')).toBeLessThan(two.indexOf('Kuva 1.'));
    const one = renderAttachmentSectionHtml({ images: images(3), pdfs: [], layout: 'one_per_page' });
    expect(one.match(/class="liite-sivu one"/g)).toHaveLength(3);
    expect(one).not.toContain('liite-sivu two');
  });

  it('escapes captions and pdf names and uses a data-uri img', () => {
    const html = renderAttachmentSectionHtml({
      images: [{ dataUri: 'data:image/png;base64,abc"def', caption: 'A & <B>' }],
      pdfs: [{ name: 'a<b>.pdf' }],
    });
    expect(html).toContain('class="liitteet page-break"');
    expect(html).toContain('object-fit: contain');
    expect(html).toContain('src="data:image/png;base64,abc&quot;def"');
    expect(html).toContain('Kuva 1. A &amp; &lt;B&gt;');
    expect(html).toContain('Liitteenä: a&lt;b&gt;.pdf');
    expect(html).not.toContain('A & <B>');
    expect(html).not.toContain('a<b>.pdf');
  });

  it('lists pdf names without image pages and returns nothing when empty', () => {
    const pdfOnly = renderAttachmentSectionHtml({ images: [], pdfs: [{ name: 'Esimerkki.pdf' }] });
    expect(pdfOnly).toContain('<h2>Liitteet</h2>');
    expect(pdfOnly).toContain('Liitteenä: Esimerkki.pdf');
    expect(pdfOnly).not.toContain('<figure');
    expect(renderAttachmentSectionHtml({ images: [], pdfs: [] })).toBe('');
  });

  it('leaves the offer and the card byte-identical when there is no section', () => {
    const offer = buildPdfContext(input(record({ name: 'Testi Asiakas' })));
    const plainOffer = renderTarjousHtml(offer);
    expect(renderTarjousHtml(offer, {})).toBe(plainOffer);
    expect(renderTarjousHtml(offer, { attachmentHtml: '' })).toBe(plainOffer);
    expect(plainOffer).not.toContain('.liitteet');
    expect(plainOffer).toContain(pageNumberContent());

    const card = buildUrakkakorttiContext(input(record({ name: 'Testi Asiakas' })));
    const plainCard = renderUrakkakorttiHtml(card);
    expect(renderUrakkakorttiHtml(card, {})).toBe(plainCard);
    expect(renderUrakkakorttiHtml(card, { attachmentHtml: '' })).toBe(plainCard);
    expect(plainCard).not.toContain('.liitteet');
  });

  it('appends the section after the KTV page and the card, and keeps the page-number rule', () => {
    const section = renderAttachmentSectionHtml({
      images: [{ dataUri: PNG, caption: 'Julkisivu' }],
      pdfs: [{ name: 'Liite.pdf' }],
    });
    const offer = buildPdfContext(input(record({ name: 'Testi Asiakas' })));
    const offerHtml = renderTarjousHtml(offer, { attachmentHtml: section, knownTotalPages: 6 });
    expect(offerHtml.indexOf('class="liitteet page-break"')).toBeGreaterThan(offerHtml.indexOf('class="ktv-page page-break"'));
    expect(offerHtml.indexOf('class="liitteet page-break"')).toBeLessThan(offerHtml.lastIndexOf('</td></tr></tbody>'));
    expect(offerHtml).toContain('"Sivu " counter(page) "/6"');
    expect(offerHtml).toContain('Kuva 1. Julkisivu');
    expect(renderTarjousHtml(offer, { attachmentHtml: section })).toContain(pageNumberContent());

    const card = buildUrakkakorttiContext(input(record({ name: 'Testi Asiakas' })));
    const cardHtml = renderUrakkakorttiHtml(card, { attachmentHtml: section, knownTotalPages: 4 });
    expect(cardHtml.indexOf('class="liitteet page-break"')).toBeGreaterThan(cardHtml.indexOf('class="uk-title"'));
    expect(cardHtml).toContain('"Sivu " counter(page) "/4"');
    expect(cardHtml).toContain(pageNumberContent(4));

    const host = '<table><tbody><tr><td>\nrunko\n</td></tr></tbody></table>';
    expect(appendAttachmentSection(host, '')).toBe(host);
    expect(appendAttachmentSection(host, section).indexOf('liitteet')).toBeLessThan(
      appendAttachmentSection(host, section).lastIndexOf('</td></tr></tbody>'),
    );
  });
});

describe('prepareAttachmentPrint', () => {
  function deps(files: Record<string, string | Uint8Array | null>) {
    return {
      loadImageDataUri: async (item: Attachment) => {
        const value = files[item.id];
        return typeof value === 'string' ? value : null;
      },
      readPdfBytes: async (item: Attachment) => {
        const value = files[item.id];
        return value instanceof Uint8Array ? value : null;
      },
    };
  }

  it('skips a missing image and a missing pdf and keeps the readable ones', async () => {
    const prepared = await prepareAttachmentPrint(
      [
        attachment({ id: 'gone', caption: 'Katoava', sortOrder: 0 }),
        attachment({ id: 'ok', caption: 'A & <B>', sortOrder: 1 }),
        attachment({ id: 'pdf-gone', kind: 'pdf', caption: '', sortOrder: 2, fileRelPath: 'attachments/c1/puuttuva.pdf' }),
        attachment({ id: 'pdf-ok', kind: 'pdf', caption: 'Sopimus <luonnos>', sortOrder: 3 }),
        attachment({ id: 'other', destination: 'card', sortOrder: 4 }),
      ],
      'offer',
      deps({ ok: PNG, 'pdf-ok': new Uint8Array([1, 2, 3]) }),
    );
    expect(prepared.warnings).toEqual([
      attachmentImageMissingMessage('Katoava'),
      attachmentPdfMissingMessage('puuttuva.pdf'),
    ]);
    expect(prepared.html).toContain('Kuva 1. A &amp; &lt;B&gt;');
    expect(prepared.html).not.toContain('Katoava');
    expect(prepared.html).toContain('Liitteenä: Sopimus &lt;luonnos&gt;');
    expect(prepared.pdfBytes).toEqual([new Uint8Array([1, 2, 3])]);
    expect(prepared.skippedImages).toEqual([]);
  });

  it('reports images past the cap and a size estimate over 15 MB', async () => {
    const images = Array.from({ length: 21 }, (_, index) =>
      attachment({ id: `i${index}`, sortOrder: index, caption: `N${index}` }),
    );
    const files = Object.fromEntries(images.map((item) => [item.id, PNG]));
    const prepared = await prepareAttachmentPrint(images, 'offer', deps(files));
    expect(prepared.skippedImages.map((item) => item.id)).toEqual(['i20']);
    expect(prepared.warnings[0]).toBe(attachmentImagesCappedMessage(1));
    expect(prepared.html).toContain('Kuva 20. N19');
    expect(prepared.html).not.toContain('N20');
    expect(prepared.imageSectionTooLarge).toBe(false);

    const huge = await prepareAttachmentPrint(
      [attachment({ id: 'big', sizeBytes: (ATTACHMENT_IMAGE_SECTION_WARN_BYTES * 3) / 4 + 1 })],
      'offer',
      deps({ big: PNG }),
    );
    expect(huge.imageSectionTooLarge).toBe(true);
    expect(huge.warnings).toEqual([ATTACHMENT_IMAGE_SECTION_TOO_LARGE_MESSAGE]);
    expect(huge.html).toContain('Kuva 1');
  });

  it('uses one image per page when asked', async () => {
    const prepared = await prepareAttachmentPrint(
      [
        attachment({ id: 'a', sortOrder: 0, destination: 'card' }),
        attachment({ id: 'b', sortOrder: 1, destination: 'card' }),
      ],
      'card',
      deps({ a: PNG, b: PNG }),
      'one_per_page',
    );
    expect(prepared.html.match(/class="liite-sivu one"/g)).toHaveLength(2);
    expect(prepared.warnings).toEqual([]);
  });
});
