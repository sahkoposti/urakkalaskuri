import type { CalculationRecord } from '@/src/core/models/types';

import { ATTACHMENT_COPY_FAILED_MESSAGE } from './attachmentMessages';
import type { Attachment, AttachmentCopyFailure } from './types';

export type CalculationCopySource = {
  record: CalculationRecord;
  attachmentCopyFailures: AttachmentCopyFailure[];
};

export type CalculationCopyDeps = {
  newId: () => string;
  copyCalculationRecord: (source: CalculationRecord, newId: string) => Promise<CalculationCopySource>;
  saveCalculation: (record: CalculationRecord) => Promise<void>;
  removeAllAttachments: (calculationId: string) => Promise<void>;
  listAttachments: (calculationId: string) => Promise<Attachment[]>;
};

export type CalculationCopyCommit =
  | {
      ok: true;
      record: CalculationRecord;
      copiedCount: number;
      failures: AttachmentCopyFailure[];
      message: string;
      offerRemove: boolean;
    }
  | { ok: false; message: string };

/** Ilmoitus kopion jälkeen. Poistonappi vain, jos liitteitä oikeasti kopioitui. */
export function calculationCopyNotice(
  copiedCount: number,
  failures: readonly AttachmentCopyFailure[],
): { message: string; offerRemove: boolean } {
  const lines = ['Laskelma kopioitiin.'];
  if (copiedCount > 0) lines.push('Liitteet kopioitiin mukaan.');
  if (failures.length > 0) {
    lines.push('Näitä liitteitä ei kopioitu:');
    for (const failure of failures) lines.push(failure.message);
  }
  return { message: lines.join('\n'), offerRemove: copiedCount > 0 };
}

/**
 * copyCalculationRecord kopioi liitetiedostot ennen tallennusta.
 * Laskelma tallennetaan heti sen jälkeen. Jos tallennus epäonnistuu,
 * kopioidut liitteet poistetaan.
 */
export async function commitCalculationCopy(
  source: CalculationRecord,
  deps: CalculationCopyDeps,
): Promise<CalculationCopyCommit> {
  const newId = deps.newId();
  let copied: CalculationCopySource;
  try {
    copied = await deps.copyCalculationRecord(source, newId);
  } catch {
    await deps.removeAllAttachments(newId).catch(() => undefined);
    return { ok: false, message: ATTACHMENT_COPY_FAILED_MESSAGE };
  }
  try {
    await deps.saveCalculation(copied.record);
  } catch {
    await deps.removeAllAttachments(newId).catch(() => undefined);
    return { ok: false, message: ATTACHMENT_COPY_FAILED_MESSAGE };
  }
  let stored: Attachment[] = [];
  try {
    stored = await deps.listAttachments(copied.record.id);
  } catch {
    stored = [];
  }
  const notice = calculationCopyNotice(stored.length, copied.attachmentCopyFailures);
  return {
    ok: true,
    record: copied.record,
    copiedCount: stored.length,
    failures: copied.attachmentCopyFailures,
    message: notice.message,
    offerRemove: notice.offerRemove,
  };
}
