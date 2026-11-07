import type { CalculationResult } from '@/src/core/calculation/calculationPipeline';
import type { CalculationRecord, FormSnapshot, PersistedWizardDraft, Product, StructureLine } from '@/src/core/models/types';
import { applyFormResultToLine, saveIncompleteFormToLine } from '@/src/core/structure/applyFormToLine';
import { calculationToFormState } from '@/src/core/wizard/calculationToWizard';
import { isDraftCalculation, wizardDraftForStorage } from '@/src/core/wizard/draftCalculation';
import {
  buildPersistedWizardDraft,
  composerStateSignature,
  mergeWizardDraftEditMeta,
  persistedDraftToFormState,
} from '@/src/core/wizard/wizardDraftHelpers';

/** Sama sisältö kuin laskentanäytön allekirjoitus. Sessioliput eivät vaikuta. */
export function wizardDraftContentSignature(draft: PersistedWizardDraft): string {
  return composerStateSignature(persistedDraftToFormState(wizardDraftForStorage(draft), []).form);
}

export function calculationContentSignature(record: CalculationRecord): string {
  const { form } = calculationToFormState(record, []);
  const draft = buildPersistedWizardDraft(form, {
    editCalculationId: record.id,
    originalCreatedAt: record.createdAt,
    editFormVersion: record.formSnapshot?.formVersion,
  });
  return wizardDraftContentSignature(draft);
}

export function parseStashedCalculation(json: string | undefined): CalculationRecord | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as CalculationRecord;
    if (!value || typeof value.id !== 'string') return null;
    value.createdAt = new Date(value.createdAt);
    return value;
  } catch {
    return null;
  }
}

/**
 * Muuttumaton sisältö ei kirjoita valmista riviä uudelleen.
 * Jos rivi ehdittiin alentaa ja sisältö palasi samaksi, palautetaan tallettettu valmis rivi.
 */
export function unchangedCompletedAction(
  draft: PersistedWizardDraft,
  linked: CalculationRecord | null,
): { action: 'keep' | 'restore'; record: CalculationRecord } | null {
  const stashed = parseStashedCalculation(draft.completedRecordJson);
  const baseline = stashed ?? (linked && !isDraftCalculation(linked) ? linked : null);
  if (!baseline) return null;
  if (wizardDraftContentSignature(draft) !== calculationContentSignature(baseline)) return null;
  if (linked && isDraftCalculation(linked)) {
    return stashed ? { action: 'restore', record: stashed } : null;
  }
  if (linked && !isDraftCalculation(linked)) return { action: 'keep', record: linked };
  return null;
}

export function draftReplacingLine(
  wizardDraft: PersistedWizardDraft,
  products: Product[],
  line: StructureLine,
  routeEditId?: string,
): PersistedWizardDraft {
  const { form } = persistedDraftToFormState(wizardDraft, products);
  const nextLines = (form.structureLines ?? []).map((item) => (item.id === line.id ? line : item));
  return buildPersistedWizardDraft(
    { ...form, structureLines: nextLines },
    mergeWizardDraftEditMeta(
      {
        editCalculationId: routeEditId,
        originalCreatedAt: wizardDraft.originalCreatedAt,
        editFormVersion: wizardDraft.editFormVersion,
      },
      wizardDraft,
    ),
    wizardDraft,
  );
}

/** Paluu ja tausta säilyttävät kentät. Ne eivät aja kaavahintaa. */
export function lineFormPreservesInputsOnLeave(reason: 'back' | 'background'): 'prompt' | 'save-inputs' {
  return reason === 'background' ? 'save-inputs' : 'prompt';
}

/** Keskeneräinen tai paluulla säilytetty lomake. Hinnat ja yliajot jäävät riville. */
export function lineFormInputLine(line: StructureLine, fieldValues: Record<string, string>): StructureLine {
  return saveIncompleteFormToLine(line, fieldValues);
}

/**
 * Vain Valmis. `refreshPrices` true korvaa kaavahinnat, false säilyttää yliajot.
 */
export function lineFormFinishedLine(
  line: StructureLine,
  result: CalculationResult,
  fieldValues: Record<string, string>,
  commissionPercent: number,
  refreshPrices: boolean,
  extras?: { formVersion?: number; snapshot?: FormSnapshot },
): StructureLine {
  return applyFormResultToLine(line, result, fieldValues, commissionPercent, {
    formVersion: extras?.formVersion,
    snapshot: extras?.snapshot,
    refreshPrices,
  });
}
