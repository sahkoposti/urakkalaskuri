import { extractFormulaIdentifiers } from '@/src/core/form/formula/evaluator';
import type { FormDefinition, FormField } from '@/src/core/form/types';

/** Tunniste viittaa kenttään suoraan tai tuote-attribuuttina (`maali.menekki`). */
export function formulaReferencesFieldKey(formula: string, fieldKey: string): boolean {
  if (!formula.trim() || !fieldKey) return false;
  for (const ident of extractFormulaIdentifiers(formula)) {
    if (ident === fieldKey || ident.startsWith(`${fieldKey}.`)) return true;
  }
  return false;
}

function addDependent(graph: Map<string, string[]>, fromKey: string, computedKey: string): void {
  const list = graph.get(fromKey);
  if (list) {
    if (!list.includes(computedKey)) list.push(computedKey);
    return;
  }
  graph.set(fromKey, [computedKey]);
}

/**
 * Computed-kentät, joiden kaava riippuu muuttuneesta avaimesta suoraan tai
 * toisen computed-kentän kautta.
 */
export function computedFieldsAffectedByKeyChange(form: FormDefinition, changedKey: string): string[] {
  const computed = form.fields.filter((item) => item.type === 'computed');
  const dependentsByKey = new Map<string, string[]>();

  for (const field of computed) {
    const formula = field.formula ?? '';
    if (!formula.trim()) continue;
    for (const ident of extractFormulaIdentifiers(formula)) {
      addDependent(dependentsByKey, ident, field.key);
      const dot = ident.indexOf('.');
      if (dot > 0) addDependent(dependentsByKey, ident.slice(0, dot), field.key);
    }
  }

  const affected: string[] = [];
  const seen = new Set<string>([changedKey]);
  const queue = [changedKey];

  while (queue.length > 0) {
    const key = queue.shift()!;
    for (const next of dependentsByKey.get(key) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      affected.push(next);
      queue.push(next);
    }
  }

  return affected;
}

/** Computed-kentän riippuvuudet muista computed-kentistä (täsmällinen avain). */
export function computedFieldDependencies(form: FormDefinition, field: FormField): string[] {
  if (!field.formula || field.type !== 'computed') return [];

  const computedKeys = new Set(
    form.fields.filter((item) => item.type === 'computed').map((item) => item.key),
  );
  const deps = new Set<string>();

  for (const ident of extractFormulaIdentifiers(field.formula)) {
    if (ident === field.key) continue;
    if (computedKeys.has(ident)) {
      deps.add(ident);
    }
  }

  return [...deps];
}

export function missingComputedDependencies(
  form: FormDefinition,
  field: FormField,
  context: Record<string, number>,
): string[] {
  return computedFieldDependencies(form, field).filter((dep) => !(dep in context));
}
