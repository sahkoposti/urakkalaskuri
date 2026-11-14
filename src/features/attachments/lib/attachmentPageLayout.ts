import type { CalculationRecord, FormSnapshot } from '@/src/core/models/types';

import {
  DEFAULT_ATTACHMENT_PAGE_LAYOUT,
  type AttachmentPageLayout,
} from './attachmentPrintPlan';

export const ATTACHMENT_PAGE_LAYOUT_KEY = 'attachmentPageLayout' as const;

/** Puuttuva avain on kaksi kuvaa sivulla. Tallennetaan laskelman form_snapshotiin. */
export function readAttachmentPageLayout(
  snapshot: FormSnapshot | null | undefined,
): AttachmentPageLayout {
  return snapshot?.attachmentPageLayout === 'one_per_page'
    ? 'one_per_page'
    : DEFAULT_ATTACHMENT_PAGE_LAYOUT;
}

/** `two_per_page` poistaa avaimen. `one_per_page` kirjoittaa sen. */
export function calculationWithAttachmentPageLayout(
  record: CalculationRecord,
  layout: AttachmentPageLayout,
): CalculationRecord {
  const snapshot = record.formSnapshot;
  const has = !!snapshot && Object.prototype.hasOwnProperty.call(snapshot, ATTACHMENT_PAGE_LAYOUT_KEY);
  if (layout === 'two_per_page') {
    if (!has || !snapshot) return record;
    const next = { ...snapshot };
    delete next.attachmentPageLayout;
    return { ...record, formSnapshot: next };
  }
  if (has && snapshot?.attachmentPageLayout === 'one_per_page') return record;
  const nextSnapshot = (
    snapshot ? { ...snapshot, attachmentPageLayout: 'one_per_page' } : { attachmentPageLayout: 'one_per_page' }
  ) as FormSnapshot;
  return { ...record, formSnapshot: nextSnapshot };
}
