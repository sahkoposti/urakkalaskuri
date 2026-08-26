import { extractFormulaIdentifiers } from '@/src/core/form/formula/evaluator';
import type { FormDefinition, FormField } from '@/src/core/form/types';

/** Tunniste viittaa kenttään suoraan tai tuote-attribuuttina (`maali.menekki`). */
export function formulaReferencesFieldKey(formula: string, fieldKey: string): boolean {
  if (!formula.trim() || !fieldKey) return false;
  return extractFormulaIdentifiers(formula).some(
    (ident) => ident === fieldKey || ident.startsWith(`${fieldKey}.`),
  );
}

/**
 * Computed-kentät, joiden kaava riippuu muuttuneesta avaimesta suoraan tai
 * toisen computed-kentän kautta.
 */
export function computedFieldsAffectedByKeyChange(form: FormDefinition, changedKey: string): string[] {
  const computed = form.fields.filter((item) => item.type === 'computed');
  const affected: string[] = [];
  const seen = new Set<string>([changedKey]);
  const queue = [changedKey];

  while (queue.length > 0) {
    const key = queue.shift()!;
    for (const field of computed) {
      if (seen.has(field.key)) continue;
      if (!formulaReferencesFieldKey(field.formula ?? '', key)) continue;
      seen.add(field.key);
      affected.push(field.key);
      queue.push(field.key);
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
