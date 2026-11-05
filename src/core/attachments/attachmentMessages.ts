import {
  MAX_ATTACHMENT_PDF_BYTES,
  MAX_ATTACHMENT_PDF_PAGES,
  MAX_TOTAL_ATTACHMENT_BYTES,
  type AttachmentPdfFailureReason,
} from './validateAttachmentPdf';

export type { AttachmentPdfFailureReason };

const megabytes = (bytes: number) => bytes / (1024 * 1024);

export const ATTACHMENT_PDF_PASSWORD_MESSAGE =
  'Tiedosto on suojattu salasanalla. Poista suojaus ja lisää tiedosto uudelleen.';

export const ATTACHMENT_PDF_INVALID_MESSAGE = 'Tiedosto ei ole kelvollinen PDF.';

export const ATTACHMENT_PDF_CORRUPT_MESSAGE = 'PDF-tiedosto on vioittunut.';

export const ATTACHMENT_PDF_TOO_LARGE_MESSAGE =
  `Tiedosto on liian suuri. Yksi PDF saa olla enintään ${megabytes(MAX_ATTACHMENT_PDF_BYTES)} Mt ja liitteet yhteensä enintään ${megabytes(MAX_TOTAL_ATTACHMENT_BYTES)} Mt.`;

export const ATTACHMENT_PDF_TOO_MANY_PAGES_MESSAGE =
  `Liitteissä on liian monta sivua. Tarjoukseen voi liittää enintään ${MAX_ATTACHMENT_PDF_PAGES} sivua.`;

export const ATTACHMENT_PDF_MERGE_FAILED_MESSAGE =
  'Liitteiden yhdistäminen epäonnistui. Tarjous voidaan jakaa ilman liitteitä.';

const MESSAGES: Record<AttachmentPdfFailureReason, string> = {
  password: ATTACHMENT_PDF_PASSWORD_MESSAGE,
  invalid: ATTACHMENT_PDF_INVALID_MESSAGE,
  corrupt: ATTACHMENT_PDF_CORRUPT_MESSAGE,
  too_large: ATTACHMENT_PDF_TOO_LARGE_MESSAGE,
  too_many_pages: ATTACHMENT_PDF_TOO_MANY_PAGES_MESSAGE,
};

export function attachmentPdfFailureMessage(reason: AttachmentPdfFailureReason): string {
  return MESSAGES[reason];
}
