import { pipelineFieldOrder } from '@/src/core/form/formDefinitionHelpers';
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
import { buildSettingsFormulaContext } from '@/src/core/form/settingsFormulaContext';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { AppSettings, Product } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';

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
  const product = findProductById(products, getSelectedProductId(fieldValues, field.key));
  if (!product) return;
  exportProductToContext(field.key, product, context);
}

function findFieldByKey(form: FormDefinition, key: string): FormField | undefined {
  return form.fields.find((field) => field.key === key);
}

/**
 * Yhteinen kaavakontekstin laskenta wizardille ja debugille.
 * Yksi silmukka: syötteet → tuotteet → computed (järjestelmäkaavat mukaan lukien).
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
  } = options;

  const context: Record<string, number> = {
    materiaalirivit_yhteensa: materialsTotal,
    ...buildSettingsFormulaContext(settings),
  };
  const steps: FormContextStep[] = [];
  const errors: string[] = [];

  for (const field of pipelineFieldOrder(form)) {
    if (field.type === 'section') continue;

    if (isProductField(field)) {
      if (useDebugExamples) {
        const product = findProductById(products, field.debugExampleValue?.trim());
        if (!product) {
          if (collectTrace && field.required) {
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

      if (!field.formula?.trim()) {
        if (override !== null) {
          context[field.key] = override;
          if (collectTrace) {
            steps.push({
              fieldKey: field.key,
              label: field.label,
              source: 'input',
              result: override,
            });
          }
          continue;
        }
        if (collectTrace) {
          errors.push(`${field.label}: kaava puuttuu`);
        }
        continue;
      }

      if (override !== null && !useDebugExamples) {
        context[field.key] = override;
        if (collectTrace) {
          steps.push({
            fieldKey: field.key,
            label: field.label,
            source: 'input',
            result: override,
          });
        }
        continue;
      }

      if (collectTrace) {
        const missingDeps = missingComputedDependencies(form, field, context);
        if (missingDeps.length > 0) {
          const depLabels = missingDeps
            .map((dep) => findFieldByKey(form, dep)?.label ?? dep)
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
        const substituted = collectTrace ? substituteFormula(field.formula, context) : undefined;
        const result = evaluateFormula(field.formula, context);
        context[field.key] = result;
        if (collectTrace) {
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

        if (collectTrace) {
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

    if (isSystemField(field)) continue;

    const raw = useDebugExamples ? field.debugExampleValue : fieldValues[field.key];
    const parsed = parseFieldRaw(field, raw);
    if (parsed === null) {
      if (collectTrace && useDebugExamples && field.required) {
        errors.push(`${field.label}: debug-esimerkkiarvo puuttuu`);
      }
      continue;
    }

    if (field.type === 'select') {
      const option = field.options?.find((item) => item.value === parsed);
      if (!option) {
        if (collectTrace) {
          errors.push(`${field.label}: tuntematon valinta "${parsed}"`);
        }
        continue;
      }
      const numericValue = parseNumber(option.value);
      if (numericValue === null) {
        if (collectTrace) {
          errors.push(`${field.label}: valinnan arvo "${option.value}" ei ole numero`);
        }
        continue;
      }
      context[field.key] = numericValue;
      if (collectTrace) {
        steps.push({
          fieldKey: field.key,
          label: field.label,
          source: 'select',
          result: numericValue,
        });
      }
      continue;
    }

    if (typeof parsed === 'number') {
      exportNumericContext(field, parsed, context);
      if (collectTrace) {
        steps.push({
          fieldKey: field.key,
          label: field.label,
          source: 'input',
          result: parsed,
        });
      }
    }
  }

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
