import {
  applyFieldEffects,
  collectProductQuantityLines,
  materialLinesTotal,
  mergeMaterialLines,
} from '@/src/core/form/fieldEffects';
import {
  evaluateFormContext,
  reevaluateComputedFields,
} from '@/src/core/form/evaluateFormContext';
import type { FormDefinition } from '@/src/core/form/types';
import type { AppSettings, Product, WizardLineDraft } from '@/src/core/models/types';
import { getDurationDaysFromValues } from '@/src/core/wizard/wizardPageHelpers';

export class CalculationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationValidationError';
  }
}

export interface CalculationResult {
  contractPriceVat0: number;
  materialsVat0: number;
  marginEur: number;
  commissionEur: number;
  totalPriceVat0: number;
  vatAmount: number;
  totalPriceVat: number;
  workDurationDays: number;
}

export interface FormCalculationInput {
  form: FormDefinition;
  fieldValues: Record<string, string>;
  materialLines: WizardLineDraft[];
  products: Product[];
  settings: AppSettings;
  reverseVat?: boolean;
  legacyDuration?: string;
}

export interface FormCalculationOutput {
  context: Record<string, number>;
  result: CalculationResult;
  materialLines: WizardLineDraft[];
}

/** Tuotantoputki: syötteet + tuotteet + asetukset + lomakekaavat. */
export function runProductionPipeline(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  materialsTotal: number,
  settings: AppSettings,
  products: Product[] = [],
  options: { strictSystemFields?: boolean } = {},
): Record<string, number> {
  const strictSystemFields = options.strictSystemFields ?? true;
  try {
    return evaluateFormContext({
      form,
      settings,
      materialsTotal,
      fieldValues,
      products,
      strictSystemFields,
    }).context;
  } catch (error) {
    if (error instanceof CalculationValidationError) throw error;
    throw new CalculationValidationError(
      error instanceof Error ? error.message : 'Kaavavirhe',
    );
  }
}

function resolveGroupDurationHours(
  context: Record<string, number>,
  fieldValues: Record<string, string>,
  settings: AppSettings,
  legacyDuration = '',
  durationMultiplier = 1,
  durationAddHours = 0,
  required = true,
): number | null {
  let hours: number;

  const fromContext = context.tyoryhma_kesto_h;
  if (fromContext !== undefined && fromContext > 0) {
    hours = fromContext;
  } else {
    const days = getDurationDaysFromValues(fieldValues, legacyDuration);
    if (days === null) {
      if (!required) return null;
      throw new CalculationValidationError('Anna työryhmän kesto (pv).');
    }
    hours = days * settings.workdayHours;
  }

  return hours * durationMultiplier + durationAddHours;
}

function readContextNumber(
  context: Record<string, number>,
  keys: string[],
  label: string,
): number {
  for (const key of keys) {
    const value = context[key];
    if (value !== undefined && Number.isFinite(value)) {
      return value;
    }
  }
  throw new CalculationValidationError(`${label}: arvoa ei voitu laskea kaavasta`);
}

/** Rakentaa CalculationResult lomakekontekstista (järjestelmäkaavat). */
export function buildResultFromFormulaContext(
  context: Record<string, number>,
  settings: AppSettings,
  groupDurationHours: number,
  reverseVat = false,
): CalculationResult {
  const margin = settings.defaultMarginPercent / 100;
  const commission = settings.defaultCommissionPercent / 100;
  if (margin + commission >= 1) {
    throw new CalculationValidationError(
      'Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.',
    );
  }

  if (!(groupDurationHours > 0)) {
    throw new CalculationValidationError('Työryhmän keston on oltava suurempi kuin 0.');
  }

  const contractPriceVat0 = readContextNumber(context, ['urakka_hinta_alv0'], 'Urakkahinta');
  const materialsVat0 = readContextNumber(context, ['materiaalit_alv0'], 'Materiaalit');
  const totalPriceVat = readContextNumber(context, ['kokonaishinta'], 'Kokonaishinta');
  const marginEur = readContextNumber(context, ['myyntikate', 'myyntikate_eur'], 'Myyntikate');
  const commissionEur = readContextNumber(
    context,
    ['myyntipalkkio', 'myyntipalkkio_eur'],
    'Myyntipalkkio',
  );

  let totalPriceVat0: number;
  let vatAmount: number;
  if (reverseVat) {
    totalPriceVat0 = totalPriceVat;
    vatAmount = 0;
  } else {
    totalPriceVat0 = readContextNumber(context, ['kokonaishinta_alv0'], 'Kokonaishinta (alv0)');
    vatAmount = readContextNumber(context, ['alv_maara'], 'ALV');
  }

  return {
    contractPriceVat0,
    materialsVat0,
    marginEur,
    commissionEur,
    totalPriceVat0,
    vatAmount,
    totalPriceVat,
    workDurationDays: groupDurationHours / settings.workdayHours,
  };
}

export interface ResolveFormContextInput {
  form: FormDefinition;
  fieldValues: Record<string, string>;
  materialLines: WizardLineDraft[];
  products: Product[];
  settings: AppSettings;
  legacyDuration?: string;
  /** false = live-esikatselu (ei heitä kestovirhettä). */
  strict?: boolean;
}

export interface ResolveFormContextOutput {
  context: Record<string, number>;
  materialLines: WizardLineDraft[];
  groupDurationHours: number | null;
}

/**
 * Field-efektit + kaksi kierrosta kaavaputkea.
 * Käytössä sekä wizardin loppulaskennassa että live-esikatselussa.
 */
export function resolveFormContextWithEffects(
  input: ResolveFormContextInput,
): ResolveFormContextOutput {
  const strict = input.strict ?? true;
  const formProductLines = collectProductQuantityLines(input.form, input.fieldValues, input.products);
  const baseMaterialLines = mergeMaterialLines(input.materialLines, formProductLines);
  const baseMaterialsVat0 = materialLinesTotal(baseMaterialLines);

  const draftContext = runProductionPipeline(
    input.form,
    input.fieldValues,
    baseMaterialsVat0,
    input.settings,
    input.products,
    { strictSystemFields: strict },
  );

  const effects = applyFieldEffects(input.form, draftContext, input.fieldValues, input.products);
  const allMaterialLines = mergeMaterialLines(baseMaterialLines, effects.materialLines);
  const materialsVat0 =
    materialLinesTotal(allMaterialLines) * effects.materialsMultiplier + effects.materialsFixedAdd;

  const context = runProductionPipeline(
    input.form,
    input.fieldValues,
    materialsVat0,
    input.settings,
    input.products,
    { strictSystemFields: strict },
  );

  const groupDurationHours = resolveGroupDurationHours(
    context,
    input.fieldValues,
    input.settings,
    input.legacyDuration,
    effects.durationMultiplier,
    effects.durationAddHours,
    strict,
  );

  if (groupDurationHours !== null) {
    const formulaHours = context.tyoryhma_kesto_h;
    if (formulaHours === undefined || Math.abs(formulaHours - groupDurationHours) > 1e-9) {
      context.tyoryhma_kesto_h = groupDurationHours;
      try {
        reevaluateComputedFields(input.form, context, {
          skipKeys: new Set(['tyoryhma_kesto_h']),
          strictSystemFields: strict,
        });
      } catch (error) {
        if (strict) {
          throw new CalculationValidationError(
            error instanceof Error ? error.message : 'Kaavavirhe',
          );
        }
      }
    }
  }

  return { context, materialLines: allMaterialLines, groupDurationHours };
}

/** Live-esikatselu: sama efektiputki kuin loppulaskennassa, soft errors. */
export function previewFormContext(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  materialLines: WizardLineDraft[],
  products: Product[],
  settings: AppSettings,
  legacyDuration?: string,
): Record<string, number> {
  try {
    return resolveFormContextWithEffects({
      form,
      fieldValues,
      materialLines,
      products,
      settings,
      legacyDuration,
      strict: false,
    }).context;
  } catch {
    return runProductionPipeline(form, fieldValues, materialLinesTotal(materialLines), settings, products, {
      strictSystemFields: false,
    });
  }
}

/**
 * Wizardin laskenta: kaavaputki + efektit → CalculationResult järjestelmäkaavoista.
 */
export function runFormCalculation(input: FormCalculationInput): FormCalculationOutput {
  const { context, materialLines, groupDurationHours } = resolveFormContextWithEffects({
    form: input.form,
    fieldValues: input.fieldValues,
    materialLines: input.materialLines,
    products: input.products,
    settings: input.settings,
    legacyDuration: input.legacyDuration,
    strict: true,
  });

  if (groupDurationHours === null) {
    throw new CalculationValidationError('Anna työryhmän kesto (pv).');
  }

  const result = buildResultFromFormulaContext(
    context,
    input.settings,
    groupDurationHours,
    input.reverseVat,
  );

  return { context, result, materialLines };
}
