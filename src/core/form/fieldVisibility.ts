import type {
  FormDefinition,
  FormField,
  FieldVisibilityCondition,
  FieldVisibilityOperator,
} from '@/src/core/form/types';
import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';
import { parseNumber } from '@/src/core/utils/formatters';

const VISIBILITY_SOURCE_TYPES = new Set(['boolean', 'select', 'number', 'computed']);

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

/** Onko lomakkeella showWhen-ehto, joka lukee lasketun kentän arvoa. */
export function formHasComputedShowWhen(form: FormDefinition): boolean {
  const computedKeys = new Set(
    form.fields.filter((field) => field.type === 'computed').map((field) => field.key),
  );
  if (computedKeys.size === 0) return false;
  return form.fields.some(
    (field) => Boolean(field.showWhen?.fieldKey) && computedKeys.has(field.showWhen!.fieldKey),
  );
}

/** Operaattorit jotka sopivat riippuvan kentän tyypille. */
export function operatorsForVisibilitySource(
  source: FormField | undefined,
): FieldVisibilityOperator[] {
  if (source?.type === 'number' || source?.type === 'computed') {
    return ['eq', 'neq', 'gt', 'lt', 'gte', 'lte'];
  }
  return ['eq', 'neq'];
}

export function isNumericVisibilityOperator(
  operator: FieldVisibilityOperator | undefined,
): boolean {
  return operator === 'gt' || operator === 'lt' || operator === 'gte' || operator === 'lte';
}

/** JSON-tuonti voi antaa true/1; kaava ja .trim() vaativat merkkijonon. */
export function normalizeVisibilityConditionValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
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
  const trimmed = (raw ?? '').trim();
  return trimmed;
}

function isNumericVisibilitySource(source: FormField | undefined): boolean {
  return source?.type === 'number' || source?.type === 'computed';
}

function compareEquality(
  actual: string,
  expected: string,
  source: FormField | undefined,
): boolean {
  if (isNumericVisibilitySource(source)) {
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
  const expected = normalizeVisibilityConditionValue(condition.value);

  if (isNumericVisibilitySource(source) && !NUMERIC_OPERATORS.has(operator)) {
    return false;
  }
  if (!isNumericVisibilitySource(source) && isNumericVisibilityOperator(operator)) {
    return false;
  }

  if (EQUALITY_OPERATORS.has(operator)) {
    const matches = compareEquality(actual, expected, source);
    return operator === 'eq' ? matches : !matches;
  }

  return compareNumeric(operator, actual, expected);
}

function readConditionActual(
  condition: FieldVisibilityCondition,
  fieldValues: Record<string, string>,
  form: FormDefinition,
  numericContext?: Record<string, number>,
): { actual: string; source: FormField | undefined } {
  const source = form.fields.find((item) => item.key === condition.fieldKey);
  const fromContext =
    source?.type === 'computed' &&
    numericContext &&
    Object.prototype.hasOwnProperty.call(numericContext, source.key)
      ? String(numericContext[source.key])
      : undefined;
  const actual =
    fromContext ??
    comparableFieldValue(
      source,
      source ? resolveFieldRawValue(source, fieldValues) : fieldValues[condition.fieldKey],
    );
  return { actual, source };
}

/**
 * Täyttääkö näkyvyysehto nykyiset vastaukset (ei ketjuta muita ehtoja).
 * Puuttuva ehto = true.
 */
export function isVisibilityConditionMet(
  condition: FieldVisibilityCondition | undefined,
  fieldValues: Record<string, string>,
  form: FormDefinition,
  numericContext?: Record<string, number>,
): boolean {
  if (!condition?.fieldKey) return true;
  const { actual, source } = readConditionActual(condition, fieldValues, form, numericContext);
  return conditionMatches(condition, actual, source);
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
  numericContext?: Record<string, number>,
): boolean {
  const condition = field.showWhen;
  if (!condition?.fieldKey) return true;

  if (visiting.has(field.key)) return true;
  visiting.add(field.key);

  const dependency = form.fields.find((item) => item.key === condition.fieldKey);
  if (dependency && !isFieldVisible(dependency, fieldValues, form, visiting, numericContext)) {
    return false;
  }

  return isVisibilityConditionMet(condition, fieldValues, form, numericContext);
}

/** Näkyykö kenttä yhteenvedossa: wizardin showWhen ja valinnainen showOnSummaryWhen. */
export function isFieldVisibleOnSummary(
  field: FormField,
  fieldValues: Record<string, string>,
  form: FormDefinition,
  numericContext?: Record<string, number>,
): boolean {
  if (!isFieldVisible(field, fieldValues, form, new Set(), numericContext)) return false;
  return isVisibilityConditionMet(field.showOnSummaryWhen, fieldValues, form, numericContext);
}

export function filterVisibleFields(
  fields: FormField[],
  fieldValues: Record<string, string>,
  form: FormDefinition,
  numericContext?: Record<string, number>,
): FormField[] {
  return fields.filter((field) => isFieldVisible(field, fieldValues, form, new Set(), numericContext));
}

/** Poistaa piilotettujen kenttien arvot (laskenta / yhteenveto). */
export function omitHiddenFieldValues(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  numericContext?: Record<string, number>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(fieldValues)) {
    const field = form.fields.find((item) => item.key === key);
    if (!field || isFieldVisible(field, fieldValues, form, new Set(), numericContext)) {
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
  const expected = normalizeVisibilityConditionValue(condition.value);
  let valueLabel = expected;
  if (dep?.type === 'boolean') {
    valueLabel = expected === 'true' ? 'Kyllä' : 'Ei';
  } else if (dep?.type === 'select') {
    valueLabel = dep.options?.find((option) => option.value === expected)?.label ?? expected;
  } else if (dep?.type === 'number' || dep?.type === 'computed') {
    valueLabel = expected.trim() || '–';
  }
  return `${label} ${op} ${valueLabel}`;
}
