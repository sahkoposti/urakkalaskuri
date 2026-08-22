import { evaluateFormContext } from '@/src/core/form/evaluateFormContext';
import { extractFormulaIdentifiers } from '@/src/core/form/formula/evaluator';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { AppSettings } from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';

export type DebugStepSource = 'input' | 'select' | 'computed';

export interface DebugPipelineOptions {
  settings?: AppSettings;
  materialsVat0?: number;
}

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

function findFieldByKey(form: FormDefinition, key: string): FormField | undefined {
  return form.fields.find((field) => field.key === key);
}

function findFieldProvidingVariable(form: FormDefinition, ident: string): FormField | undefined {
  const exact = findFieldByKey(form, ident);
  if (exact) return exact;

  const baseKey = ident.split('.')[0] ?? ident;
  if (baseKey !== ident) {
    return findFieldByKey(form, baseKey);
  }
  return undefined;
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

/** Live-debug: sama evaluateFormContext kuin wizardissa, debug-esimerkkisyötteillä. */
export function runDebugPipeline(
  form: FormDefinition,
  focusFieldKey?: string,
  options: DebugPipelineOptions = {},
): DebugTrace {
  const settings = options.settings ?? defaultSettings;
  const materialsVat0 = options.materialsVat0 ?? 0;

  const { context, steps, errors } = evaluateFormContext({
    form,
    settings,
    materialsTotal: materialsVat0,
    useDebugExamples: true,
    collectTrace: true,
    strictSystemFields: false,
  });

  if (focusFieldKey) {
    const filtered = filterTraceForFocus(form, focusFieldKey, steps, errors);
    return { context, steps: filtered.steps, errors: filtered.errors };
  }

  return { context, steps, errors };
}
