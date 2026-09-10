import { applyOwnedVatTotals } from '@/src/core/calculation/pricingSkeleton';
import { pipelineFieldOrder, getFieldByKey } from '@/src/core/form/formDefinitionHelpers';
import {
  fieldValuesForVisibility,
  formHasComputedShowWhen,
  isFieldVisible,
} from '@/src/core/form/fieldVisibility';
import {
  evaluateFormula,
  FormulaEvaluationError,
  substituteFormula,
} from '@/src/core/form/formula/evaluator';
import { missingComputedDependencies } from '@/src/core/form/formula/formulaDependencies';
import { exportProductToContext } from '@/src/core/form/productContext';
import {
  findProductById,
  getSelectedProductId,
  isProductField,
} from '@/src/core/form/productFieldUtils';
import { buildCalculationFormulaContext } from '@/src/core/form/calculationFormulaContext';
import { buildSettingsFormulaContext } from '@/src/core/form/settingsFormulaContext';
import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';
import { isMaterialsSystemField, isSystemField, MATERIALS_CONTEXT_KEY } from '@/src/core/form/systemFields';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { AppSettings, Product } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';
import { clampDiscountPercent, isDiscountPercentKey } from '@/src/core/calculation/discount';

export type FormContextStepSource = 'input' | 'select' | 'computed';

export interface FormContextStep {
  fieldKey: string;
  label: string;
  source: FormContextStepSource;
  formula?: string;
  substituted?: string;
  result: number;
  error?: string;
}

export interface EvaluateFormContextOptions {
  form: FormDefinition;
  settings: AppSettings;
  materialsTotal: number;
  fieldValues?: Record<string, string>;
  products?: Product[];
  /** Lukee debugExampleValue fieldValuesin sijaan. */
  useDebugExamples?: boolean;
  /** Heitä virhe järjestelmäkaavan epäonnistuessa (wizard). */
  strictSystemFields?: boolean;
  /** Kerää debug-jälki (soft errors). */
  collectTrace?: boolean;
  reverseVat?: boolean;
  extraContext?: Record<string, number>;
}

export interface EvaluateFormContextResult {
  context: Record<string, number>;
  steps: FormContextStep[];
  errors: string[];
}

function parseFieldRaw(
  field: FormField,
  raw: string | undefined,
): number | string | boolean | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  switch (field.type) {
    case 'number':
    case 'computed':
      return parseNumber(trimmed);
    case 'boolean':
      return trimmed === 'true' || trimmed === 'kyllä' || trimmed === '1';
    case 'select':
      return trimmed;
    case 'text':
      return trimmed;
    default:
      return null;
  }
}

function exportNumericContext(
  field: FormField,
  value: number | string | boolean,
  context: Record<string, number>,
): void {
  if (typeof value === 'number') {
    context[field.key] = value;
    return;
  }
  if (typeof value === 'boolean') {
    context[field.key] = value ? 1 : 0;
  }
}

function exportProductField(
  field: FormField,
  fieldValues: Record<string, string>,
  products: Product[],
  context: Record<string, number>,
): void {
  const product = findProductById(
    products,
    getSelectedProductId(fieldValues, field.key, field),
  );
  if (!product) return;
  exportProductToContext(field.key, product, context);
}

/**
 * Yhteinen kaavakontekstin laskenta wizardille ja debugille.
 * Syötteet → tuotteet → computed. Toinen kierros huomioi computed-showWhen-ehdot.
 */
export function evaluateFormContext(options: EvaluateFormContextOptions): EvaluateFormContextResult {
  const {
    form,
    settings,
    materialsTotal,
    fieldValues = {},
    products = [],
    useDebugExamples = false,
    strictSystemFields = false,
    collectTrace = false,
    reverseVat = false,
    extraContext,
  } = options;

  const context: Record<string, number> = {
    [MATERIALS_CONTEXT_KEY]: materialsTotal,
    ...buildSettingsFormulaContext(settings),
    ...buildCalculationFormulaContext(),
    ...extraContext,
  };
  // Syötekentät alkavat nollasta, jotta tyhjä kytkin/numero ei kaada live-kaavaa.
  // Computed-kenttiä ei siemennetä, jotta debug voi edelleen raportoida puuttuvat riippuvuudet.
  for (const field of form.fields) {
    if (field.type === 'section' || field.type === 'text' || field.type === 'computed') continue;
    context[field.key] = 0;
  }

  const steps: FormContextStep[] = [];
  const errors: string[] = [];
  const visibilityValues = fieldValuesForVisibility(form, fieldValues, useDebugExamples);
  const orderedFields = pipelineFieldOrder(form);
  const needsComputedVisibilityPass = formHasComputedShowWhen(form);

  const processPass = (visibilityContext: Record<string, number> | undefined, recordTrace: boolean) => {
    for (const field of orderedFields) {
      if (field.type === 'section') continue;
      if (!isFieldVisible(field, visibilityValues, form, new Set(), visibilityContext)) {
        context[field.key] = 0;
        continue;
      }

      if (isProductField(field)) {
        if (useDebugExamples) {
          const product = findProductById(products, field.debugExampleValue?.trim());
          if (!product) {
            if (recordTrace && field.required) {
              errors.push(`${field.label}: debug-esimerkkiarvo puuttuu`);
            }
            continue;
          }
          exportProductToContext(field.key, product, context);
          continue;
        }
        exportProductField(field, fieldValues, products, context);
        continue;
      }

      if (field.type === 'computed') {
        const overrideRaw = useDebugExamples ? field.debugExampleValue : fieldValues[field.key];
        const override =
          field.allowManualOverride !== false ? parseNumber(overrideRaw?.trim() ?? '') : null;
        const keepMaterialsSeed = isMaterialsSystemField(field);

        if (!field.formula?.trim() || keepMaterialsSeed) {
          if (override !== null) {
            context[field.key] = isDiscountPercentKey(field.key)
              ? clampDiscountPercent(override)
              : override;
            if (recordTrace) {
              steps.push({
                fieldKey: field.key,
                label: field.label,
                source: 'input',
                result: override,
              });
            }
            continue;
          }
          if (keepMaterialsSeed) {
            continue;
          }
          if (!field.formula?.trim()) {
            if (recordTrace) {
              errors.push(`${field.label}: kaava puuttuu`);
            }
            continue;
          }
        }

        if (override !== null && !useDebugExamples) {
          context[field.key] = isDiscountPercentKey(field.key)
            ? clampDiscountPercent(override)
            : override;
          if (recordTrace) {
            steps.push({
              fieldKey: field.key,
              label: field.label,
              source: 'input',
              result: override,
            });
          }
          continue;
        }

        if (recordTrace) {
          const missingDeps = missingComputedDependencies(form, field, context);
          if (missingDeps.length > 0) {
            const depLabels = missingDeps
              .map((dep) => getFieldByKey(form, dep)?.label ?? dep)
              .join(', ');
            const message = `Odottaa laskettuja kenttiä: ${depLabels}`;
            errors.push(`${field.label}: ${message}`);
            steps.push({
              fieldKey: field.key,
              label: field.label,
              source: 'computed',
              formula: field.formula,
              result: Number.NaN,
              error: message,
            });
            continue;
          }
        }

        try {
          const substituted = recordTrace ? substituteFormula(field.formula, context) : undefined;
          const result = evaluateFormula(field.formula, context);
          context[field.key] = result;
          if (recordTrace) {
            steps.push({
              fieldKey: field.key,
              label: field.label,
              source: 'computed',
              formula: field.formula,
              substituted,
              result,
            });
          }
        } catch (error) {
          const message =
            error instanceof FormulaEvaluationError
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Kaavavirhe';

          if (strictSystemFields && isSystemField(field)) {
            throw new FormulaEvaluationError(`${field.label}: ${message}`);
          }

          if (recordTrace) {
            errors.push(`${field.label}: ${message}`);
            steps.push({
              fieldKey: field.key,
              label: field.label,
              source: 'computed',
              formula: field.formula,
              result: Number.NaN,
              error: message,
            });
          }
        }
        continue;
      }

      if (isSystemField(field) && field.type !== 'number') continue;

      const rawFromValues = useDebugExamples ? field.debugExampleValue : undefined;
      const raw = useDebugExamples
        ? rawFromValues?.trim()
        : resolveFieldRawValue(field, fieldValues) || undefined;
      const parsed = parseFieldRaw(field, raw);
      if (parsed === null) {
        if (recordTrace && useDebugExamples && field.required) {
          errors.push(`${field.label}: debug-esimerkkiarvo puuttuu`);
        }
        continue;
      }

      if (field.type === 'select') {
        const option = field.options?.find((item) => item.value === parsed);
        if (!option) {
          if (recordTrace) {
            errors.push(`${field.label}: tuntematon valinta "${parsed}"`);
          }
          continue;
        }
        const numericValue = parseNumber(option.value);
        if (numericValue === null) {
          if (recordTrace) {
            errors.push(`${field.label}: valinnan arvo "${option.value}" ei ole numero`);
          }
          continue;
        }
        context[field.key] = numericValue;
        if (recordTrace) {
          steps.push({
            fieldKey: field.key,
            label: field.label,
            source: 'select',
            result: numericValue,
          });
        }
        continue;
      }

      if (typeof parsed === 'number' || typeof parsed === 'boolean') {
        exportNumericContext(field, parsed, context);
        if (isDiscountPercentKey(field.key) && typeof context[field.key] === 'number') {
          context[field.key] = clampDiscountPercent(context[field.key]);
        }
        if (recordTrace && typeof context[field.key] === 'number') {
          steps.push({
            fieldKey: field.key,
            label: field.label,
            source: field.type === 'boolean' ? 'select' : 'input',
            result: context[field.key]!,
          });
        }
      }
    }
  };

  if (needsComputedVisibilityPass) {
    processPass(undefined, false);
    processPass(context, collectTrace);
  } else {
    processPass(undefined, collectTrace);
  }

  const totalField = form.fields.find((field) => field.key === 'kokonaishinta');
  const sellingOverrideRaw = totalField
    ? useDebugExamples
      ? totalField.debugExampleValue
      : fieldValues[totalField.key]
    : undefined;
  const sellingPriceVatOverridden =
    totalField?.allowManualOverride !== false &&
    parseNumber(sellingOverrideRaw?.trim() ?? '') !== null &&
    (useDebugExamples || Object.prototype.hasOwnProperty.call(fieldValues, 'kokonaishinta'));
  applyOwnedVatTotals(context, settings.vatPercent, reverseVat, { sellingPriceVatOverridden });

  return { context, steps, errors };
}

/** Laskee computed-kentät uudelleen; skipKeys säilyttää annetut arvot. */
export function reevaluateComputedFields(
  form: FormDefinition,
  context: Record<string, number>,
  options: { skipKeys?: Set<string>; strictSystemFields?: boolean } = {},
): void {
  const skipKeys = options.skipKeys ?? new Set<string>();
  const strictSystemFields = options.strictSystemFields ?? false;

  for (const field of pipelineFieldOrder(form)) {
    if (field.type !== 'computed' || !field.formula) continue;
    if (skipKeys.has(field.key)) continue;
    try {
      context[field.key] = evaluateFormula(field.formula, context);
    } catch (error) {
      if (strictSystemFields && isSystemField(field)) {
        throw error;
      }
    }
  }
}
