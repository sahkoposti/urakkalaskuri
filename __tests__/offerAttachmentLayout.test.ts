import {
  ATTACHMENT_CAPTION_LINE_BUDGET,
  ATTACHMENT_CAPTION_PT,
  ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM,
  captionLineCount,
  offerAttachmentLayoutForCaptions,
  offerAttachmentLayoutForHeight,
  offerCaptionContentWidthMm,
  resolveOfferAttachmentLayout,
} from '../src/core/attachments/attachmentSectionHtml';

const MM_PER_PT = 25.4 / 72;

function charsPerLine(extraPt: number): number {
  return Math.max(1, Math.floor(offerCaptionContentWidthMm() / ((ATTACHMENT_CAPTION_PT + extraPt) * MM_PER_PT)));
}

/** Kuvateksti, jonka rivimäärä etuliitteen kanssa on tasan `lines`. */
function captionOfLines(lines: number, extraPt: number, index = 1): string {
  const prefix = `Kuva ${index}. `;
  const perLine = charsPerLine(extraPt);
  return 'M'.repeat(Math.max(1, perLine * lines - prefix.length));
}

describe('offer attachment layout', () => {
  it('uses two images per page for short captions and one when the block is too tall', () => {
    expect(ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM).toBeLessThan(80);
    expect(resolveOfferAttachmentLayout(['Julkisivu', 'Sokkeli'])).toBe('two_per_page');
    expect(resolveOfferAttachmentLayout()).toBe('two_per_page');
    expect(offerAttachmentLayoutForHeight(80)).toBe('one_per_page');
    expect(offerAttachmentLayoutForCaptions(['Lyhyt'], { imageMaxMm: 200 })).toBe('one_per_page');
    expect(offerAttachmentLayoutForHeight(ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM)).toBe('two_per_page');
  });

  it('keeps two per page at the caption line budget and switches at one line over', () => {
    const atBudget = captionOfLines(ATTACHMENT_CAPTION_LINE_BUDGET, 1);
    const over = captionOfLines(ATTACHMENT_CAPTION_LINE_BUDGET + 1, 1);
    expect(captionLineCount(atBudget, 1, 1)).toBe(ATTACHMENT_CAPTION_LINE_BUDGET);
    expect(captionLineCount(over, 1, 1)).toBe(ATTACHMENT_CAPTION_LINE_BUDGET + 1);
    expect(resolveOfferAttachmentLayout([atBudget, 'Lyhyt'])).toBe('two_per_page');
    expect(resolveOfferAttachmentLayout(['Lyhyt', over])).toBe('one_per_page');
  });

  it('counts the +1 pt caption so a boundary caption can move from two pages to one', () => {
    const atPlus = captionOfLines(ATTACHMENT_CAPTION_LINE_BUDGET, 1);
    expect(captionLineCount(atPlus, 1, 1)).toBeLessThanOrEqual(ATTACHMENT_CAPTION_LINE_BUDGET);
    const wider = charsPerLine(0);
    const narrower = charsPerLine(1);
    expect(narrower).toBeLessThan(wider);
    const boundary = 'M'.repeat(narrower * ATTACHMENT_CAPTION_LINE_BUDGET);
    expect(captionLineCount(boundary, 0, 1)).toBeLessThanOrEqual(ATTACHMENT_CAPTION_LINE_BUDGET);
    expect(captionLineCount(boundary, 1, 1)).toBeGreaterThan(ATTACHMENT_CAPTION_LINE_BUDGET);
    expect(offerAttachmentLayoutForCaptions([boundary], { extraPt: 0 })).toBe('two_per_page');
    expect(offerAttachmentLayoutForCaptions([boundary], { extraPt: 1 })).toBe('one_per_page');
  });
});
