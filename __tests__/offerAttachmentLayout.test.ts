import {
  ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM,
  offerAttachmentLayoutForHeight,
  resolveOfferAttachmentLayout,
} from '../src/core/attachments/attachmentSectionHtml';

describe('offer attachment layout', () => {
  it('keeps two images per page at the conservative height and falls back when they do not fit', () => {
    expect(ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM).toBeLessThan(80);
    expect(resolveOfferAttachmentLayout()).toBe('two_per_page');
    expect(offerAttachmentLayoutForHeight(80)).toBe('one_per_page');
    expect(offerAttachmentLayoutForHeight(ATTACHMENT_IMAGE_MAX_HEIGHT_TWO_MM)).toBe('two_per_page');
    expect(offerAttachmentLayoutForHeight(200)).toBe('one_per_page');
  });
});
