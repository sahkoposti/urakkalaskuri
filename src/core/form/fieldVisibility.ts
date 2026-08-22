import type {
  FormDefinition,
  FormField,
  FieldVisibilityCondition,
  FieldVisibilityOperator,
} from '@/src/core/form/types';
import { parseNumber } from '@/src/core/utils/formatters';

const VISIBILITY_SOURCE_TYPES = new Set(['boolean', 'select', 'number']);

const EQUALITY_OPERATORS = new Set<FieldVisibilityOperator>(['eq', 'neq']);
const NUMERIC_OPERATORS = new Set<FieldVisibilityOperator>([
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
]);

export function isVisibilitySourceField(field: FormField): boolean {
  return VISIBILITY_SOURCE_TYPES.has(field.type);
}

/** Operaattorit jotka sopivat riippuvan kentän tyypille. */
export function operatorsForVisibilitySource(
  source: FormField | undefined,
): FieldVisibilityOperator[] {
  if (source?.type === 'number') {
    return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'];
  }
  return ['eq', 'neq'];
}

export function isNumericVisibilityOperator(
  operator: FieldVisibilityOperator | undefined,
): boolean {
  return operator === 'gt' || operator === 'lt' || operator === 'gte' || operator === 'lte';
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

function compareEquality(
  actual: string,
  expected: string,
  source: FormField | undefined,
): boolean {
  if (source?.type === 'number') {
    const left = parseNumber(actual);
    const right = parseNumber(expected);
    if (left !== null && right !== null) return left === right;
  }
  return actual === expected.trim();
}

function compareNumeric(
  operator: FieldVisibilityOperator,
  actual: string,
  expected: string,
): boolean {
  const left = parseNumber(actual);
  const right = parseNumber(expected);
  if (left === null || right === null) return false;
  switch (operator) {
    case 'gt':
      return left > right;
    case 'lt':
      return left < right;
    case 'gte':
      return left >= right;
    case 'lte':
      return left <= right;
    default:
      return false;
  }
}

function conditionMatches(
  condition: FieldVisibilityCondition,
  actual: string,
  source: FormField | undefined,
): boolean {
  const operator: FieldVisibilityOperator = condition.operator ?? 'eq';
  const expected = condition.value;

  if (source?.type === 'number' && !NUMERIC_OPERATORS.has(operator)) {
    return false;
  }
  if (source?.type !== 'number' && isNumericVisibilityOperator(operator)) {
    return false;
  }

  if (EQUALITY_OPERATORS.has(operator)) {
    const matches = compareEquality(actual, expected, source);
    return operator === 'eq' ? matches : !matches;
  }

  return compareNumeric(operator, actual, expected);
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
  return conditionMatches(condition, actual, dependency);
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

const OPERATOR_SYMBOLS: Record<FieldVisibilityOperator, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
};

export function visibilityOperatorSymbol(
  operator: FieldVisibilityOperator | undefined,
): string {
  return OPERATOR_SYMBOLS[operator ?? 'eq'];
}

export function visibilityConditionSummary(
  condition: FieldVisibilityCondition | undefined,
  form: FormDefinition,
): string | null {
  if (!condition?.fieldKey) return null;
  const dep = form.fields.find((field) => field.key === condition.fieldKey);
  const label = dep?.label ?? condition.fieldKey;
  const op = visibilityOperatorSymbol(condition.operator);
  let valueLabel = condition.value;
  if (dep?.type === 'boolean') {
    valueLabel = condition.value === 'true' ? 'Kyllä' : 'Ei';
  } else if (dep?.type === 'select') {
    valueLabel =
      dep.options?.find((option) => option.value === condition.value)?.label ?? condition.value;
  } else if (dep?.type === 'number') {
    valueLabel = condition.value.trim() || '–';
  }
  return `${label} ${op} ${valueLabel}`;
}
