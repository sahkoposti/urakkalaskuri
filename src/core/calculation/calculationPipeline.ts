import {
  applyDurationEffects,
  applyFieldEffects,
  applyMaterialEffects,
  formHasFieldEffects,
  materialLinesTotal,
} from '@/src/core/form/fieldEffects';
import {
  evaluateFormContext,
  reevaluateComputedFields,
  type EvaluateFormContextResult,
  type FormContextStep,
} from '@/src/core/form/evaluateFormContext';
import type { FormDefinition } from '@/src/core/form/types';
import type { AppSettings, Product, WizardLineDraft } from '@/src/core/models/types';
import { getDurationDaysFromValues } from '@/src/core/wizard/wizardPageHelpers';
import {
  applyDiscountToResult,
  discountPercentFromContext,
  writeDiscountedResultToContext,
} from '@/src/core/calculation/discount';
import { applyOwnedVatTotals } from '@/src/core/calculation/pricingSkeleton';
import { overriddenComputedKeys, parsedComputedOverride } from '@/src/core/form/applyFieldValueChange';

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
  discountPercent: number;
  discountEur: number;
  totalPriceVatBeforeDiscount: number;
  totalPriceVat0BeforeDiscount: number;
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
export function evaluateProductionPipeline(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  materialsTotal: number,
  settings: AppSettings,
  products: Product[] = [],
  options: { strictSystemFields?: boolean; collectTrace?: boolean } = {},
): EvaluateFormContextResult {
  const strictSystemFields = options.strictSystemFields ?? true;
  const collectTrace = options.collectTrace ?? false;
  try {
    return evaluateFormContext({
      form,
      settings,
      materialsTotal,
      fieldValues,
      products,
      strictSystemFields,
      collectTrace,
    });
  } catch (error) {
    if (error instanceof CalculationValidationError) throw error;
    throw new CalculationValidationError(
      error instanceof Error ? error.message : 'Kaavavirhe',
    );
  }
}

export function runProductionPipeline(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  materialsTotal: number,
  settings: AppSettings,
  products: Product[] = [],
  options: { strictSystemFields?: boolean } = {},
): Record<string, number> {
  return evaluateProductionPipeline(form, fieldValues, materialsTotal, settings, products, options)
    .context;
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
      throw new CalculationValidationError('Anna työn kesto (pv).');
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

/** Rakentaa CalculationResult lomakekontekstista (vientiavaimet + rungon ALV). */
export function buildResultFromFormulaContext(
  context: Record<string, number>,
  settings: AppSettings,
  groupDurationHours: number,
  reverseVat = false,
  sellingPriceVatOverridden = false,
): CalculationResult {
  const margin = settings.defaultMarginPercent / 100;
  const commission = settings.defaultCommissionPercent / 100;
  if (margin + commission >= 1) {
    throw new CalculationValidationError(
      'Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.',
    );
  }

  if (!(groupDurationHours > 0)) {
    throw new CalculationValidationError('Työn keston on oltava suurempi kuin 0.');
  }

  applyOwnedVatTotals(context, settings.vatPercent, reverseVat, { sellingPriceVatOverridden });

  const contractPriceVat0 = readContextNumber(context, ['urakka_hinta_alv0'], 'Urakkahinta');
  const materialsVat0 = readContextNumber(context, ['materiaalit', 'materiaalit_alv0'], 'Materiaalit');
  const totalPriceVat0 = readContextNumber(context, ['kokonaishinta_alv0'], 'Kokonaishinta (alv0)');
  const totalPriceVat = readContextNumber(context, ['kokonaishinta'], 'Kokonaishinta');
  const marginEur = readContextNumber(context, ['myyntikate', 'myyntikate_eur'], 'Myyntikate');
  const commissionEur = readContextNumber(
    context,
    ['myyntipalkkio', 'myyntipalkkio_eur'],
    'Myyntipalkkio',
  );
  const vatAmount = reverseVat ? 0 : readContextNumber(context, ['alv_maara'], 'ALV');

  const listResult: CalculationResult = {
    contractPriceVat0,
    materialsVat0,
    marginEur,
    commissionEur,
    totalPriceVat0,
    vatAmount,
    totalPriceVat,
    workDurationDays: groupDurationHours / settings.workdayHours,
    discountPercent: 0,
    discountEur: 0,
    totalPriceVatBeforeDiscount: totalPriceVat,
    totalPriceVat0BeforeDiscount: totalPriceVat0,
  };

  const discounted = applyDiscountToResult(
    listResult,
    discountPercentFromContext(context),
    reverseVat,
  );
  writeDiscountedResultToContext(context, discounted);
  return discounted;
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
  /** Kerää kaavavälivaiheet (debug). */
  collectTrace?: boolean;
}

export interface ResolveFormContextOutput {
  context: Record<string, number>;
  materialLines: WizardLineDraft[];
  groupDurationHours: number | null;
  steps: FormContextStep[];
  errors: string[];
}

/**
 * Field-efektit sovelletaan vasta laskennan lopussa:
 * 1) kaavat perusmateriaaleilla
 * 2) kerää lisä-/kerroinvaikutukset
 * 3) päivitä materiaalit ja kesto
 * 4) laske järjestelmäkaavat uudelleen lopullisilla arvoilla
 */
export function resolveFormContextWithEffects(
  input: ResolveFormContextInput,
): ResolveFormContextOutput {
  const strict = input.strict ?? true;
  const materialLines = [...input.materialLines];
  const baseMaterialsVat0 = materialLinesTotal(materialLines);

  // 1) Kaavat ensin (perusmateriaalit ja kesto)
  const draftContext = runProductionPipeline(
    input.form,
    input.fieldValues,
    baseMaterialsVat0,
    input.settings,
    input.products,
    { strictSystemFields: strict },
  );

  // 2) Kerää loppuvaikutukset
  const effects = applyFieldEffects(input.form, draftContext, input.fieldValues, input.products);

  // 3) Materiaalit ja kesto vasta lopussa
  const materialsVat0 = applyMaterialEffects(baseMaterialsVat0, effects);

  const baseHours = resolveGroupDurationHours(
    draftContext,
    input.fieldValues,
    input.settings,
    input.legacyDuration,
    1,
    0,
    strict,
  );

  const groupDurationHours =
    baseHours === null ? null : applyDurationEffects(baseHours, effects);

  // 4) Lopullinen kaavalaskenta lopullisilla materiaaleilla (+ kestopäivitys)
  const collectTrace = input.collectTrace ?? false;
  const finalPipeline = evaluateProductionPipeline(
    input.form,
    input.fieldValues,
    materialsVat0,
    input.settings,
    input.products,
    { strictSystemFields: strict, collectTrace },
  );
  const context = finalPipeline.context;
  const steps = collectTrace ? finalPipeline.steps : [];
  const errors = collectTrace ? finalPipeline.errors : [];

  if (groupDurationHours !== null) {
    const formulaHours = context.tyoryhma_kesto_h;
    if (formulaHours === undefined || Math.abs(formulaHours - groupDurationHours) > 1e-9) {
      context.tyoryhma_kesto_h = groupDurationHours;
      try {
        reevaluateComputedFields(input.form, context, {
          skipKeys: new Set([
            'tyoryhma_kesto_h',
            ...overriddenComputedKeys(input.form, input.fieldValues),
          ]),
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

  applyOwnedVatTotals(context, input.settings.vatPercent, false, {
    sellingPriceVatOverridden:
      parsedComputedOverride(input.form, input.fieldValues, 'kokonaishinta') !== null,
  });

  return { context, materialLines, groupDurationHours, steps, errors };
}

/** Live-esikatselu + valinnainen debug-jälki (sama laskenta kuin wizardissa). */
export function previewFormContextDetailed(
  input: ResolveFormContextInput,
): ResolveFormContextOutput {
  const collectTrace = input.collectTrace ?? false;

  try {
    if (!formHasFieldEffects(input.form)) {
      const result = evaluateFormContext({
        form: input.form,
        settings: input.settings,
        materialsTotal: materialLinesTotal(input.materialLines),
        fieldValues: input.fieldValues,
        products: input.products,
        strictSystemFields: false,
        collectTrace,
      });
      return {
        context: result.context,
        materialLines: [...input.materialLines],
        groupDurationHours: resolveGroupDurationHours(
          result.context,
          input.fieldValues,
          input.settings,
          input.legacyDuration,
          1,
          0,
          false,
        ),
        steps: collectTrace ? result.steps : [],
        errors: collectTrace ? result.errors : [],
      };
    }
    return resolveFormContextWithEffects({
      ...input,
      strict: false,
    });
  } catch {
    const result = evaluateProductionPipeline(
      input.form,
      input.fieldValues,
      materialLinesTotal(input.materialLines),
      input.settings,
      input.products,
      { strictSystemFields: false, collectTrace },
    );
    return {
      context: result.context,
      materialLines: [...input.materialLines],
      groupDurationHours: null,
      steps: collectTrace ? result.steps : [],
      errors: collectTrace ? result.errors : [],
    };
  }
}

/** Live-esikatselu: sama tulos kuin finish, ilman turhaa toista kaavakierrosta. */
export function previewFormContext(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  materialLines: WizardLineDraft[],
  products: Product[],
  settings: AppSettings,
  legacyDuration?: string,
): Record<string, number> {
  return previewFormContextDetailed({
    form,
    fieldValues,
    materialLines,
    products,
    settings,
    legacyDuration,
  }).context;
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
    throw new CalculationValidationError('Anna työn kesto (pv).');
  }

  const result = buildResultFromFormulaContext(
    context,
    input.settings,
    groupDurationHours,
    input.reverseVat,
    parsedComputedOverride(input.form, input.fieldValues, 'kokonaishinta') !== null,
  );

  return { context, result, materialLines };
}
