import type { FormDefinition, FormField, SelectOption } from '@/src/core/form/types';
import {
  evaluateFormula,
  extractFormulaIdentifiers,
  FormulaEvaluationError,
  substituteFormula,
} from '@/src/core/form/formula/evaluator';
import { parseNumber } from '@/src/core/utils/formatters';

export type DebugStepSource = 'input' | 'select' | 'computed';

export interface DebugStep {
  fieldKey: string;
  label: string;
  source: DebugStepSource;
  formula?: string;
  substituted?: string;
  result: number;
  error?: string;
}

export interface DebugTrace {
  context: Record<string, number>;
  steps: DebugStep[];
  errors: string[];
}

import { pipelineFieldOrder } from '@/src/core/form/formDefinitionHelpers';

function applySelectExports(option: SelectOption | undefined, context: Record<string, number>): void {
  if (!option) return;
  if (option.exportKey) {
    const value = option.exportValue ?? option.multiplier ?? option.workFactor ?? option.materialFactor;
    if (value !== undefined) {
      context[option.exportKey] = value;
    }
  }
}

function parseDebugValue(field: FormField): number | string | boolean | null {
  const raw = field.debugExampleValue?.trim();
  if (!raw) return null;

  switch (field.type) {
    case 'number':
    case 'computed':
      return parseNumber(raw);
    case 'boolean':
      return raw === 'true' || raw === 'kyllä' || raw === '1';
    case 'select':
      return raw;
    case 'text':
      return raw;
    default:
      return null;
  }
}

function exportNumericContext(field: FormField, value: number | string | boolean, context: Record<string, number>): void {
  if (typeof value === 'number') {
    context[field.key] = value;
    return;
  }
  if (typeof value === 'boolean') {
    context[field.key] = value ? 1 : 0;
  }
}

function findFieldByKey(form: FormDefinition, key: string): FormField | undefined {
  return form.fields.find((field) => field.key === key);
}

function findFieldProvidingVariable(form: FormDefinition, varName: string): FormField | undefined {
  const byKey = findFieldByKey(form, varName);
  if (byKey) return byKey;

  return form.fields.find(
    (field) =>
      field.type === 'select' && field.options?.some((option) => option.exportKey === varName),
  );
}

/** Kentät, jotka vaikuttavat focus-kentän laskentaan (suoraan tai välillisesti). */
export function collectRelevantFieldKeys(form: FormDefinition, focusFieldKey: string): Set<string> {
  const relevant = new Set<string>();

  function visit(fieldKey: string): void {
    if (relevant.has(fieldKey)) return;
    relevant.add(fieldKey);

    const field = findFieldByKey(form, fieldKey);
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

export function runDebugPipeline(
  form: FormDefinition,
  focusFieldKey?: string,
): DebugTrace {
  const context: Record<string, number> = {};
  const steps: DebugStep[] = [];
  const errors: string[] = [];

  for (const field of pipelineFieldOrder(form)) {
    if (field.type === 'section') continue;

    if (field.type === 'computed') {
      if (!field.formula) {
        errors.push(`${field.label}: kaava puuttuu`);
        continue;
      }
      try {
        const substituted = substituteFormula(field.formula, context);
        const result = evaluateFormula(field.formula, context);
        context[field.key] = result;
        steps.push({
          fieldKey: field.key,
          label: field.label,
          source: 'computed',
          formula: field.formula,
          substituted,
          result,
        });
      } catch (error) {
        const message = error instanceof FormulaEvaluationError ? error.message : 'Kaavavirhe';
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
      continue;
    }

    const parsed = parseDebugValue(field);
    if (parsed === null) {
      if (field.required) {
        errors.push(`${field.label}: debug-esimerkkiarvo puuttuu`);
      }
      continue;
    }

    if (field.type === 'select') {
      const option = field.options?.find((item) => item.value === parsed);
      if (!option) {
        errors.push(`${field.label}: tuntematon valinta "${parsed}"`);
        continue;
      }
      applySelectExports(option, context);
      steps.push({
        fieldKey: field.key,
        label: field.label,
        source: 'select',
        result: option.multiplier ?? option.exportValue ?? 0,
      });
      continue;
    }

    if (typeof parsed === 'number') {
      exportNumericContext(field, parsed, context);
      steps.push({
        fieldKey: field.key,
        label: field.label,
        source: 'input',
        result: parsed,
      });
    }
  }

  if (focusFieldKey) {
    const filtered = filterTraceForFocus(form, focusFieldKey, steps, errors);
    return { context, steps: filtered.steps, errors: filtered.errors };
  }

  return { context, steps, errors };
}

export function getFieldById(form: FormDefinition, fieldId: string): FormField | undefined {
  return form.fields.find((field) => field.id === fieldId);
}

export function updateFieldInForm(form: FormDefinition, updated: FormField): FormDefinition {
  return {
    ...form,
    fields: form.fields.map((field) => (field.id === updated.id ? updated : field)),
    updatedAt: Date.now(),
  };
}
