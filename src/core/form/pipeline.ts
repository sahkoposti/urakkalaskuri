import {
  CalculationValidationError,
  runCalculation,
  type CalculationResult,
} from '@/src/core/calculation/calculationEngine';
import { sortComputedFields } from '@/src/core/form/formula/dependencies';
import {
  evaluateFormula,
  FormulaEvaluationError,
  substituteFormula,
} from '@/src/core/form/formula/evaluator';
import { writeProductAttributes } from '@/src/core/form/productAttributes';
import type {
  FieldValue,
  FormDefinition,
  FormField,
  ProductQuantityValue,
  SelectOption,
} from '@/src/core/form/types';
import { DURATION_DAYS_KEY } from '@/src/core/form/types';
import type { AppSettings, CalculationLine, Product } from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';

export type DebugStepSource = 'input' | 'select' | 'product' | 'computed' | 'effect';

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
  materialLines: CalculationLine[];
  groupDurationHours: number;
  materialsVat0: number;
  summaryFields: SummaryFieldValue[];
}

export interface PipelineInput {
  formDefinition: FormDefinition;
  fieldValues: Record<string, FieldValue>;
  settings: AppSettings;
  defaults?: Record<string, number>;
  products: Product[];
}

export interface SummaryFieldValue {
  key: string;
  label: string;
  value: string | number | boolean;
  unit?: string;
  pageTitle: string;
}

export interface PipelineResult {
  context: Record<string, number>;
  steps: DebugStep[];
  errors: string[];
  materialsVat0: number;
  groupDurationHours: number;
  materialLines: CalculationLine[];
  summaryFields: SummaryFieldValue[];
  calculation: CalculationResult | null;
}

export interface DebugPipelineOptions {
  focusFieldKey?: string;
  products?: Product[];
  settings?: AppSettings;
  defaults?: Record<string, number>;
}

function sortedPages(form: FormDefinition) {
  return [...form.pages].sort((a, b) => a.sortOrder - b.sortOrder);
}

function sortedFields(form: FormDefinition): FormField[] {
  const pageOrder = new Map(sortedPages(form).map((page, index) => [page.id, index]));
  return [...form.fields].sort((a, b) => {
    const pageDiff = (pageOrder.get(a.pageId) ?? 0) - (pageOrder.get(b.pageId) ?? 0);
    if (pageDiff !== 0) return pageDiff;
    return a.sortOrder - b.sortOrder;
  });
}

function settingsToContext(settings: AppSettings): Record<string, number> {
  return {
    'settings.default_hourly_rate': settings.defaultHourlyRate,
    'settings.vat_percent': settings.vatPercent,
    'settings.workday_hours': settings.workdayHours,
    'settings.default_crew_size': settings.defaultCrewSize,
    'settings.default_margin_percent': settings.defaultMarginPercent,
    'settings.default_commission_percent': settings.defaultCommissionPercent,
  };
}

function defaultsToContext(defaults: Record<string, number> | undefined): Record<string, number> {
  if (!defaults) return {};
  return Object.fromEntries(
    Object.entries(defaults)
      .filter(([, value]) => Number.isFinite(value))
      .map(([key, value]) => [`defaults.${key}`, value]),
  );
}

function applySelectExports(option: SelectOption | undefined, context: Record<string, number>): void {
  if (!option) return;
  if (option.exportKey) {
    const value = option.exportValue ?? option.multiplier ?? option.workFactor ?? option.materialFactor;
    if (value !== undefined) {
      context[option.exportKey] = value;
    }
  }
}

function isProductQuantityValue(value: unknown): value is ProductQuantityValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    'productId' in value &&
    'quantity' in value &&
    typeof (value as ProductQuantityValue).productId === 'string' &&
    typeof (value as ProductQuantityValue).quantity === 'number'
  );
}

function parseProductQuantityDebug(raw: string, field: FormField): ProductQuantityValue | null {
  if (raw.includes('|')) {
    const [id, qty] = raw.split('|');
    const quantity = parseNumber(qty ?? '');
    if (!id?.trim() || quantity === null) return null;
    return { productId: id.trim(), quantity };
  }
  const asNumber = parseNumber(raw);
  if (asNumber !== null && field.productId) {
    return { productId: field.productId, quantity: asNumber };
  }
  return { productId: raw, quantity: 1 };
}

function parseBoolean(raw: string): boolean {
  return raw === 'true' || raw === 'kyllä' || raw === '1';
}

export function collectDebugFieldValues(form: FormDefinition): Record<string, FieldValue> {
  const values: Record<string, FieldValue> = {};
  for (const field of form.fields) {
    if (field.type === 'section' || field.type === 'computed') continue;
    const raw = field.debugExampleValue?.trim();
    if (!raw) continue;

    switch (field.type) {
      case 'number':
        values[field.key] = parseNumber(raw);
        break;
      case 'boolean':
        values[field.key] = parseBoolean(raw);
        break;
      case 'product_quantity':
        values[field.key] = parseProductQuantityDebug(raw, field);
        break;
      default:
        values[field.key] = raw;
    }
  }
  return values;
}

function resolveContextNumber(
  context: Record<string, number>,
  ref: string | undefined,
  fallback?: number,
): number | null {
  if (ref && ref in context) return context[ref]!;
  if (fallback !== undefined && Number.isFinite(fallback)) return fallback;
  return null;
}

function resolveProduct(
  productRef: string | undefined,
  selectedProducts: Record<string, Product>,
  products: Product[],
): Product | null {
  if (!productRef) return null;
  if (selectedProducts[productRef]) return selectedProducts[productRef]!;
  return products.find((product) => product.id === productRef) ?? null;
}

function makeMaterialLine(product: Product, quantity: number, sourceKey: string): CalculationLine {
  return {
    id: `mat_${sourceKey}_${product.id}`,
    productId: product.id,
    productName: product.name,
    unit: product.unit,
    unitPriceVat0: product.unitPriceVat0,
    quantity,
    lineTotalVat0: quantity * product.unitPriceVat0,
  };
}

function formatSummaryValue(field: FormField, value: FieldValue, context: Record<string, number>): string | number | boolean {
  if (field.type === 'computed' || field.type === 'number') {
    return context[field.key] ?? (typeof value === 'number' ? value : '–');
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (isProductQuantityValue(value)) return value.quantity;
  if (field.key in context) return context[field.key]!;
  return '–';
}

function evaluateForm(input: PipelineInput): Omit<PipelineResult, 'calculation'> {
  const { formDefinition: form, fieldValues, settings, defaults, products } = input;
  const context: Record<string, number> = {
    ...settingsToContext(settings),
    ...defaultsToContext(defaults),
  };
  const steps: DebugStep[] = [];
  const errors: string[] = [];
  const selectedProducts: Record<string, Product> = {};
  const materialLines: CalculationLine[] = [];
  let durationFactor = 1;
  let durationAddHours = 0;
  let materialFactor = 1;
  let materialAdd = 0;

  const fields = sortedFields(form);

  for (const field of fields) {
    if (field.type === 'section' || field.type === 'computed') continue;

    const value = fieldValues[field.key];
    const missing =
      value === null ||
      value === undefined ||
      value === '' ||
      (typeof value === 'number' && !Number.isFinite(value));

    if (missing) {
      if (field.required) {
        errors.push(`${field.label}: arvo puuttuu`);
      }
      continue;
    }

    if (field.type === 'number') {
      const numeric =
        typeof value === 'number' ? value : typeof value === 'string' ? parseNumber(value) : null;
      if (numeric === null) {
        if (field.required) errors.push(`${field.label}: virheellinen luku`);
        continue;
      }
      context[field.key] = numeric;
      steps.push({
        fieldKey: field.key,
        label: field.label,
        source: 'input',
        result: numeric,
      });
      continue;
    }

    if (field.type === 'boolean') {
      const flag = value === true || value === 1 || value === 'true';
      context[field.key] = flag ? 1 : 0;
      steps.push({
        fieldKey: field.key,
        label: field.label,
        source: 'input',
        result: context[field.key],
      });
      continue;
    }

    if (field.type === 'select' && typeof value === 'string') {
      const option = field.options?.find((item) => item.value === value);
      if (!option) {
        errors.push(`${field.label}: tuntematon valinta "${value}"`);
        continue;
      }
      applySelectExports(option, context);
      if (option.workFactor !== undefined) {
        durationFactor *= option.workFactor;
      }
      if (option.materialFactor !== undefined) {
        materialFactor *= option.materialFactor;
      }
      steps.push({
        fieldKey: field.key,
        label: field.label,
        source: 'select',
        result: option.multiplier ?? option.exportValue ?? option.workFactor ?? option.materialFactor ?? 0,
      });
      continue;
    }

    if (field.type === 'product_select' && typeof value === 'string') {
      const product = products.find((item) => item.id === value);
      if (!product) {
        errors.push(`${field.label}: tuotetta ei löytynyt`);
        continue;
      }
      selectedProducts[field.key] = product;
      writeProductAttributes(field.key, product, context);
      steps.push({
        fieldKey: field.key,
        label: field.label,
        source: 'product',
        result: product.unitPriceVat0,
      });
      continue;
    }

    if (field.type === 'product_quantity') {
      const parsed = isProductQuantityValue(value)
        ? value
        : typeof value === 'number' && field.productId
          ? { productId: field.productId, quantity: value }
          : null;
      if (!parsed || parsed.quantity <= 0) {
        if (field.required) errors.push(`${field.label}: määrä puuttuu`);
        continue;
      }
      const product = products.find((item) => item.id === parsed.productId);
      if (!product) {
        errors.push(`${field.label}: tuotetta ei löytynyt`);
        continue;
      }
      selectedProducts[field.key] = product;
      writeProductAttributes(field.key, product, context);
      context[`${field.key}.quantity`] = parsed.quantity;
      materialLines.push(makeMaterialLine(product, parsed.quantity, field.key));
      steps.push({
        fieldKey: field.key,
        label: field.label,
        source: 'product',
        result: parsed.quantity,
      });
    }
  }

  let computedFields: FormField[] = [];
  try {
    computedFields = sortComputedFields(fields);
  } catch (error) {
    const message = error instanceof FormulaEvaluationError ? error.message : 'Kaavaketjun järjestys epäonnistui';
    errors.push(message);
    computedFields = fields.filter((field) => field.type === 'computed');
  }

  for (const field of computedFields) {
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
  }

  for (const field of fields) {
    for (const effect of field.effects ?? []) {
      if (effect.type === 'add_material') {
        const product = resolveProduct(effect.productRef, selectedProducts, products);
        const quantity = resolveContextNumber(context, effect.quantityRef ?? field.key, effect.amount);
        if (!product) {
          errors.push(`${field.label}: materiaalirivin tuote puuttuu`);
          continue;
        }
        if (quantity === null) {
          errors.push(`${field.label}: materiaalirivin määrä puuttuu`);
          continue;
        }
        materialLines.push(makeMaterialLine(product, quantity, field.key));
        steps.push({
          fieldKey: field.key,
          label: `${field.label} → materiaali`,
          source: 'effect',
          result: quantity,
        });
      }

      if (effect.type === 'multiply_duration') {
        const factor = resolveContextNumber(context, effect.factorRef, effect.factor);
        if (factor === null) {
          errors.push(`${field.label}: kestokerroin puuttuu`);
          continue;
        }
        durationFactor *= factor;
      }

      if (effect.type === 'add_duration') {
        const amount = resolveContextNumber(context, effect.amountRef ?? field.key, effect.amount);
        if (amount === null) {
          errors.push(`${field.label}: kestolisä puuttuu`);
          continue;
        }
        durationAddHours += amount;
      }

      if (effect.type === 'multiply_materials') {
        const factor = resolveContextNumber(context, effect.factorRef, effect.factor);
        if (factor === null) {
          errors.push(`${field.label}: materiaalikerroin puuttuu`);
          continue;
        }
        materialFactor *= factor;
      }

      if (effect.type === 'add_material_fixed') {
        const amount = resolveContextNumber(context, effect.amountRef ?? field.key, effect.amount);
        if (amount === null) {
          errors.push(`${field.label}: materiaalilisä puuttuu`);
          continue;
        }
        materialAdd += amount;
      }
    }
  }

  const baseDays = context[DURATION_DAYS_KEY] ?? 0;
  const groupDurationHours = baseDays * settings.workdayHours * durationFactor + durationAddHours;
  const rawMaterials = materialLines.reduce((sum, line) => sum + line.lineTotalVat0, 0);
  const materialsVat0 = rawMaterials * materialFactor + materialAdd;

  context.t = groupDurationHours;
  context.M = materialsVat0;

  const pagesById = new Map(form.pages.map((page) => [page.id, page]));
  const summaryFields: SummaryFieldValue[] = sortedFields(form)
    .filter((field) => field.showOnSummary && field.type !== 'section')
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: formatSummaryValue(field, fieldValues[field.key], context),
      unit: field.unit,
      pageTitle: pagesById.get(field.pageId)?.title ?? '',
    }));

  return {
    context,
    steps,
    errors,
    materialsVat0,
    groupDurationHours,
    materialLines,
    summaryFields,
  };
}

export function runPipeline(input: PipelineInput): PipelineResult {
  const evaluated = evaluateForm(input);
  if (evaluated.groupDurationHours <= 0) {
    return {
      ...evaluated,
      errors: evaluated.errors.includes('Työryhmän keston on oltava suurempi kuin 0.')
        ? evaluated.errors
        : [...evaluated.errors, 'Työryhmän keston on oltava suurempi kuin 0.'],
      calculation: null,
    };
  }

  try {
    const calculation = runCalculation({
      groupDurationHours: evaluated.groupDurationHours,
      crewSize: input.settings.defaultCrewSize,
      hourlyRate: input.settings.defaultHourlyRate,
      materialsVat0: evaluated.materialsVat0,
      marginPercent: input.settings.defaultMarginPercent,
      commissionPercent: input.settings.defaultCommissionPercent,
      vatPercent: input.settings.vatPercent,
      workdayHours: input.settings.workdayHours,
    });
    return { ...evaluated, calculation };
  } catch (error) {
    const message =
      error instanceof CalculationValidationError ? error.message : 'Laskenta epäonnistui';
    return { ...evaluated, errors: [...evaluated.errors, message], calculation: null };
  }
}

export function runDebugPipeline(
  form: FormDefinition,
  focusFieldKeyOrOptions?: string | DebugPipelineOptions,
): DebugTrace {
  const options: DebugPipelineOptions =
    typeof focusFieldKeyOrOptions === 'string'
      ? { focusFieldKey: focusFieldKeyOrOptions }
      : (focusFieldKeyOrOptions ?? {});

  const evaluated = evaluateForm({
    formDefinition: form,
    fieldValues: collectDebugFieldValues(form),
    settings: options.settings ?? defaultSettings,
    defaults: options.defaults,
    products: options.products ?? [],
  });

  if (options.focusFieldKey) {
    const focused = evaluated.steps.find((step) => step.fieldKey === options.focusFieldKey);
    if (focused && !Number.isNaN(focused.result)) {
      return evaluated;
    }
  }

  return evaluated;
}

export { getFieldById, updateFieldInForm } from '@/src/core/form/formEditor';
