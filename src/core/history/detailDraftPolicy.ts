import { firstNonEmptyId } from '@/src/core/wizard/wizardDraftHelpers';

/** Historianäkymän banneri, kun laskelmalla on uudempi muokkausluonnos. */
export const PENDING_EDIT_NOTICE = 'Tallentamattomia muutoksia';

/**
 * Sulje tyhjentää luonnoksen vain valmiista yhteenvedosta (`fromWizard`).
 * Sama `draftEditId` ja `calcId` eivät yksinään poista keskeneräistä muokkausta.
 */
export function shouldClearDraftOnDetailClose(input: {
  fromWizard: boolean;
  draftEditId?: string | null;
  calcId?: string | null;
}): boolean {
  const unfinishedEdit =
    !input.fromWizard &&
    Boolean(input.draftEditId) &&
    input.draftEditId === input.calcId;
  if (unfinishedEdit) return false;
  return input.fromWizard;
}

/** Luonnos kuuluu tälle laskelmalle, eikä yhteenveto ole vielä korvannut sitä. */
export function hasPendingEditDraft(
  record: { id: string } | null | undefined,
  draft: { editCalculationId?: string | null; updatedAt?: number | null } | null | undefined,
): boolean {
  if (!record || !draft) return false;
  const recordId = firstNonEmptyId(record.id);
  const draftId = firstNonEmptyId(draft.editCalculationId);
  return Boolean(recordId && draftId && recordId === draftId);
}
