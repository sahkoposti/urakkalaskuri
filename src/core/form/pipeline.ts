import { previewFormContextDetailed } from '@/src/core/calculation/calculationPipeline';
import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';
import { getFieldByKey } from '@/src/core/form/formDefinitionHelpers';
import { extractFormulaIdentifiers } from '@/src/core/form/formula/evaluator';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormContextStep, FormContextStepSource } from '@/src/core/form/evaluateFormContext';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { AppSettings, Product } from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';

export type DebugStepSource = FormContextStepSource;
export type DebugStep = FormContextStep;

export interface DebugPipelineOptions {
  settings?: AppSettings;
  products?: Product[];
  extraContext?: Record<string, number>;
}

/** Syötekenttien arvot debug-esimerkeistä (kaavadetut lasketaan kaavalla). */
export function buildDebugFieldValues(form: FormDefinition): Record<string, string> {
  const fieldValues: Record<string, string> = {};
  for (const field of form.fields) {
    if (field.type === 'section') continue;

    if (field.type === 'computed') {
      if (field.formula?.trim()) continue;

      const example = field.debugExampleValue?.trim();
      const defaultRaw = resolveFieldRawValue(field, fieldValues);
      const raw = example || defaultRaw;
      if (raw) fieldValues[field.key] = raw;
      continue;
    }

    const example = field.debugExampleValue?.trim();
    if (example) {
      fieldValues[field.key] = example;
      continue;
    }
    const defaultRaw = resolveFieldRawValue(field, fieldValues);
    if (defaultRaw) fieldValues[field.key] = defaultRaw;
  }
  return fieldValues;
}

function hasDebugInputValue(field: FormField): boolean {
  if (field.debugExampleValue?.trim()) return true;
  if (field.defaultValue?.trim()) return true;
  return Boolean(resolveFieldRawValue(field, {})?.trim());
}

function collectMissingDebugExampleErrors(
  form: FormDefinition,
  focusFieldKey?: string,
): string[] {
  const relevant = focusFieldKey ? collectRelevantFieldKeys(form, focusFieldKey) : null;
  const errors: string[] = [];

  for (const field of form.fields) {
    if (field.type === 'section' || field.type === 'computed' || isSystemField(field)) continue;
    if (relevant && !relevant.has(field.key)) continue;
    if (!field.required) continue;
    if (hasDebugInputValue(field)) continue;
    errors.push(`${field.label}: debug-esimerkkiarvo puuttuu`);
  }

  return errors;
}

export interface DebugTrace {
  context: Record<string, number>;
  steps: DebugStep[];
  errors: string[];
}

function findFieldProvidingVariable(form: FormDefinition, ident: string): FormField | undefined {
  const exact = getFieldByKey(form, ident);
  if (exact) return exact;

  const baseKey = ident.split('.')[0] ?? ident;
  if (baseKey !== ident) {
    return getFieldByKey(form, baseKey);
  }
  return undefined;
}

/** Kentät, jotka vaikuttavat focus-kentän laskentaan (suoraan tai välillisesti). */
export function collectRelevantFieldKeys(form: FormDefinition, focusFieldKey: string): Set<string> {
  const relevant = new Set<string>();

  function visit(fieldKey: string): void {
    if (relevant.has(fieldKey)) return;
    relevant.add(fieldKey);

    const field = getFieldByKey(form, fieldKey);
    if (!field?.formula || field.type !== 'computed') return;

    for (const ident of extractFormulaIdentifiers(field.formula)) {
      const provider = findFieldProvidingVariable(form, ident);
      if (provider) visit(provider.key);
    }
  }

  visit(focusFieldKey);
  return relevant;
}

function filterTraceForFocus(
  form: FormDefinition,
  focusFieldKey: string,
  steps: DebugStep[],
  errors: string[],
): { steps: DebugStep[]; errors: string[] } {
  const relevant = collectRelevantFieldKeys(form, focusFieldKey);

  const filteredSteps = steps.filter((step) => relevant.has(step.fieldKey));
  const filteredErrors = errors.filter((error) => {
    const field = form.fields.find((item) => error.startsWith(`${item.label}:`));
    if (!field) return true;
    return relevant.has(field.key);
  });

  return { steps: filteredSteps, errors: filteredErrors };
}

/** Live-debug: sama previewFormContextDetailed kuin wizardissa, debug-esimerkkisyötteillä. */
export function runDebugPipeline(
  form: FormDefinition,
  focusFieldKey?: string,
  options: DebugPipelineOptions = {},
): DebugTrace {
  const settings = options.settings ?? defaultSettings;
  const products = options.products ?? [];
  const fieldValues = buildDebugFieldValues(form);

  const pipelineResult = previewFormContextDetailed({
    form,
    fieldValues,
    materialLines: [],
    products,
    settings,
    strict: false,
    collectTrace: true,
    extraContext: options.extraContext,
  });

  const validationErrors = collectMissingDebugExampleErrors(form, focusFieldKey);
  const errors = [...validationErrors, ...pipelineResult.errors];
  const steps = pipelineResult.steps;

  if (focusFieldKey) {
    const filtered = filterTraceForFocus(form, focusFieldKey, steps, errors);
    return {
      context: pipelineResult.context,
      steps: filtered.steps,
      errors: filtered.errors,
    };
  }

  return {
    context: pipelineResult.context,
    steps,
    errors,
  };
}
