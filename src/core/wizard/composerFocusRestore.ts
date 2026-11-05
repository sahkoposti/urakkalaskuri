/**
 * Laskentanäkymän focus-päätös.
 *
 * Callback ei saa palauttaa näkymän avaushetkellä suljettua luonnosta.
 * Kutsuja lukee viimeisimmän luonnoksen refistä ja ohittaa palautuksen,
 * kun sama `updatedAt` on jo käytössä.
 */
export type ComposerFocusDraft = {
  updatedAt: number;
  editCalculationId?: string | null;
};

export type ComposerFocusAction = 'none' | 'restoreDraft' | 'loadRecord' | 'hydrateEmpty';

export function decideComposerFocusRestore(input: {
  routeEditId?: string | null;
  loadedEditId?: string | null;
  latestDraft?: ComposerFocusDraft | null;
  lastAppliedUpdatedAt?: number | null;
  hydrated: boolean;
}): ComposerFocusAction {
  if (input.routeEditId) {
    if (input.loadedEditId === input.routeEditId) {
      return 'none';
    }
    if (input.latestDraft && input.latestDraft.editCalculationId === input.routeEditId) {
      return 'restoreDraft';
    }
    return 'loadRecord';
  }

  if (input.latestDraft) {
    if (input.lastAppliedUpdatedAt !== input.latestDraft.updatedAt) {
      return 'restoreDraft';
    }
    return 'none';
  }

  if (!input.hydrated) {
    return 'hydrateEmpty';
  }
  return 'none';
}
