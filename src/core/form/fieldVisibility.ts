import type {
  FormDefinition,
  FormField,
  FieldVisibilityCondition,
  FieldVisibilityOperator,
} from '@/src/core/form/types';

const VISIBILITY_SOURCE_TYPES = new Set(['boolean', 'select']);

export function isVisibilitySourceField(field: FormField): boolean {
  return VISIBILITY_SOURCE_TYPES.has(field.type);
}

/** Boolean ilman arvoa tulkitaan Epäksi; muut tyypit käyttävät trimattua merkkijonoa. */
export function comparableFieldValue(
  field: FormField | undefined,
  raw: string | undefined,
): string {
  if (field?.type === 'boolean') {
    const trimmed = raw?.trim().toLowerCase() ?? '';
    return trimmed === 'true' || trimmed === '1' || trimmed === 'kyllä' ? 'true' : 'false';
  }
  return (raw ?? '').trim();
}

function conditionMatches(
  condition: FieldVisibilityCondition,
  actual: string,
): boolean {
  const operator: FieldVisibilityOperator = condition.operator ?? 'eq';
  const expected = condition.value;
  const matches = actual === expected;
  return operator === 'eq' ? matches : !matches;
}

/**
 * Onko kenttä näkyvissä nykyisillä vastauksilla.
 * Ketjuttaa: jos riippuvuuskenttä on itse piilotettu, tämäkin piilotetaan.
 */
export function isFieldVisible(
  field: FormField,
  fieldValues: Record<string, string>,
  form: FormDefinition,
  visiting: Set<string> = new Set(),
): boolean {
  const condition = field.showWhen;
  if (!condition?.fieldKey) return true;

  if (visiting.has(field.key)) return true;
  visiting.add(field.key);

  const dependency = form.fields.find((item) => item.key === condition.fieldKey);
  if (dependency && !isFieldVisible(dependency, fieldValues, form, visiting)) {
    return false;
  }

  const actual = comparableFieldValue(dependency, fieldValues[condition.fieldKey]);
  return conditionMatches(condition, actual);
}

export function filterVisibleFields(
  fields: FormField[],
  fieldValues: Record<string, string>,
  form: FormDefinition,
): FormField[] {
  return fields.filter((field) => isFieldVisible(field, fieldValues, form));
}

/** Poistaa piilotettujen kenttien arvot (laskenta / yhteenveto). */
export function omitHiddenFieldValues(
  form: FormDefinition,
  fieldValues: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(fieldValues)) {
    const field = form.fields.find((item) => item.key === key);
    if (!field || isFieldVisible(field, fieldValues, form)) {
      next[key] = value;
    }
  }
  return next;
}

/** Debug: yhdistää debugExampleValue-arvot näkyvyyden arviointiin. */
export function fieldValuesForVisibility(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  useDebugExamples: boolean,
): Record<string, string> {
  if (!useDebugExamples) return fieldValues;
  const merged = { ...fieldValues };
  for (const field of form.fields) {
    const example = field.debugExampleValue?.trim();
    if (example) merged[field.key] = example;
  }
  return merged;
}

export function visibilityConditionSummary(
  condition: FieldVisibilityCondition | undefined,
  form: FormDefinition,
): string | null {
  if (!condition?.fieldKey) return null;
  const dep = form.fields.find((field) => field.key === condition.fieldKey);
  const label = dep?.label ?? condition.fieldKey;
  const op = (condition.operator ?? 'eq') === 'eq' ? '=' : '≠';
  let valueLabel = condition.value;
  if (dep?.type === 'boolean') {
    valueLabel = condition.value === 'true' ? 'Kyllä' : 'Ei';
  } else if (dep?.type === 'select') {
    valueLabel =
      dep.options?.find((option) => option.value === condition.value)?.label ?? condition.value;
  }
  return `${label} ${op} ${valueLabel}`;
}
