import { firstNonEmptyId } from '@/src/core/wizard/wizardDraftHelpers';

/** Historianäkymän banneri, kun laskelmalla on uudempi muokkausluonnos. */
export const PENDING_EDIT_NOTICE = 'Tallentamattomia muutoksia';

/** Näytetään, kun vienti lukisi tietokannan vanhan tietueen luonnoksen sijaan. */
export const EXPORT_BLOCKED_BY_DRAFT_MESSAGE =
  'Tarjous tehdään tallennetuilla tiedoilla, joissa on vanhat hinnat. Tallenna muutokset ensin Yhteenvedossa.';

/** Avaa saman Muokkaa-reitin, joka palauttaa luonnoksen ja vie Yhteenvetoon. */
export const CONTINUE_EDIT_LABEL = 'Jatka muokkausta';

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

/**
 * Tarjous, urakkakortti ja dokumentit lukevat tallennetun tietueen.
 * Kesken oleva muokkausluonnos estää viennin, kunnes yhteenveto korvaa tietueen.
 */
export function isExportBlockedByEditDraft(
  draft: { editCalculationId?: string | null; updatedAt?: number | null } | null | undefined,
  calculationId: string | null | undefined,
): boolean {
  if (!calculationId) return false;
  return hasPendingEditDraft({ id: calculationId }, draft);
}
