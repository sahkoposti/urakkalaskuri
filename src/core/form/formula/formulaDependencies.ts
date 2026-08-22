import { extractFormulaIdentifiers } from '@/src/core/form/formula/evaluator';
import type { FormDefinition, FormField } from '@/src/core/form/types';

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
