import {
  findProductById,
  getFieldProductQuantity,
  getSelectedProductId,
} from '@/src/core/form/productFieldUtils';
import { pipelineFieldOrder } from '@/src/core/form/formDefinitionHelpers';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { Product, WizardLineDraft } from '@/src/core/models/types';

export interface FieldEffectsResult {
  materialLines: WizardLineDraft[];
  materialsFixedAdd: number;
  durationMultiplier: number;
  durationAddHours: number;
  materialsMultiplier: number;
}

function emptyEffectsResult(): FieldEffectsResult {
  return {
    materialLines: [],
    materialsFixedAdd: 0,
    durationMultiplier: 1,
    durationAddHours: 0,
    materialsMultiplier: 1,
  };
}

function resolveQuantity(
  context: Record<string, number>,
  quantityRef: string | undefined,
  field: FormField,
): number | null {
  const key = quantityRef ?? field.key;
  const value = context[key];
  if (value === undefined || !Number.isFinite(value)) return null;
  return value;
}

function resolveProduct(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  products: Product[],
  productRef: string | undefined,
): Product | null {
  if (!productRef) return null;
  const productField = form.fields.find((item) => item.key === productRef);
  if (!productField) return null;
  return findProductById(products, getSelectedProductId(fieldValues, productField.key));
}

function applyEffect(
  form: FormDefinition,
  field: FormField,
  effect: NonNullable<FormField['effects']>[number],
  context: Record<string, number>,
  fieldValues: Record<string, string>,
  products: Product[],
  result: FieldEffectsResult,
): void {
  switch (effect.type) {
    case 'add_material': {
      const quantity = resolveQuantity(context, effect.quantityRef, field);
      if (quantity === null || quantity <= 0) return;
      const product = resolveProduct(form, fieldValues, products, effect.productRef);
      if (!product) return;
      result.materialLines.push({ product, quantity });
      return;
    }
    case 'add_material_fixed': {
      const amount = resolveQuantity(context, effect.quantityRef, field);
      if (amount === null) return;
      result.materialsFixedAdd += amount;
      return;
    }
    case 'multiply_duration': {
      const factor = resolveQuantity(context, effect.quantityRef, field);
      if (factor === null || factor <= 0) return;
      result.durationMultiplier *= factor;
      return;
    }
    case 'add_duration': {
      const hours = resolveQuantity(context, effect.quantityRef, field);
      if (hours === null) return;
      result.durationAddHours += hours;
      return;
    }
    case 'multiply_materials': {
      const factor = resolveQuantity(context, effect.quantityRef, field);
      if (factor === null || factor <= 0) return;
      result.materialsMultiplier *= factor;
      return;
    }
    default:
      return;
  }
}

export function applyFieldEffects(
  form: FormDefinition,
  context: Record<string, number>,
  fieldValues: Record<string, string>,
  products: Product[],
): FieldEffectsResult {
  const result = emptyEffectsResult();

  for (const field of pipelineFieldOrder(form)) {
    if (!field.effects?.length) continue;
    for (const effect of field.effects) {
      applyEffect(form, field, effect, context, fieldValues, products, result);
    }
  }

  return result;
}

export function collectProductQuantityLines(
  form: FormDefinition,
  fieldValues: Record<string, string>,
  products: Product[],
): WizardLineDraft[] {
  const lines: WizardLineDraft[] = [];

  for (const field of pipelineFieldOrder(form)) {
    if (field.type !== 'product_quantity') continue;
    const product = findProductById(products, getSelectedProductId(fieldValues, field.key));
    const quantity = getFieldProductQuantity(fieldValues, field.key);
    if (!product || quantity === null) continue;
    lines.push({ product, quantity });
  }

  return lines;
}

export function mergeMaterialLines(...groups: WizardLineDraft[][]): WizardLineDraft[] {
  return groups.flat();
}

export function materialLinesTotal(lines: WizardLineDraft[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.product.unitPriceVat0, 0);
}
