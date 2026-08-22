import { FormulaEvaluationError } from '@/src/core/form/formula/evaluator';
import type { FormField } from '@/src/core/form/types';

const FUNCTION_NAMES = new Set(['min', 'max', 'round']);

export function extractFormulaIdentifiers(formula: string): string[] {
  const matches = formula.match(/[a-zA-Z_äöåÄÖÅ][a-zA-Z0-9_äöåÄÖÅ.]*/g) ?? [];
  return [...new Set(matches.filter((name) => !FUNCTION_NAMES.has(name)))];
}

export function sortComputedFields(fields: FormField[]): FormField[] {
  const computed = fields.filter((field) => field.type === 'computed');
  const keys = new Set(computed.map((field) => field.key));
  const incoming = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const field of computed) {
    incoming.set(field.key, 0);
    dependents.set(field.key, []);
  }

  for (const field of computed) {
    const deps = extractFormulaIdentifiers(field.formula ?? '').filter((name) => keys.has(name));
    incoming.set(field.key, deps.length);
    for (const dep of deps) {
      dependents.get(dep)?.push(field.key);
    }
  }

  const queue = computed.filter((field) => (incoming.get(field.key) ?? 0) === 0);
  const ordered: FormField[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const nextKey of dependents.get(current.key) ?? []) {
      const nextCount = (incoming.get(nextKey) ?? 0) - 1;
      incoming.set(nextKey, nextCount);
      if (nextCount === 0) {
        const nextField = computed.find((field) => field.key === nextKey);
        if (nextField) queue.push(nextField);
      }
    }
  }

  if (ordered.length !== computed.length) {
    const cyclic = computed.filter((field) => !ordered.some((item) => item.id === field.id));
    throw new FormulaEvaluationError(
      `Kaavaketjussa on kehä: ${cyclic.map((field) => field.key).join(', ')}`,
    );
  }

  return ordered;
}
