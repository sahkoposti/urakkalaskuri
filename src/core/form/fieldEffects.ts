import { pipelineFieldOrder } from '@/src/core/form/formDefinitionHelpers';
import { isFieldVisible } from '@/src/core/form/fieldVisibility';
import type { FieldEffect, FormDefinition } from '@/src/core/form/types';
import type { Product, WizardLineDraft } from '@/src/core/models/types';

export interface FieldEffectsResult {
  materialsFixedAdd: number;
  durationMultiplier: number;
  durationAddHours: number;
  materialsMultiplier: number;
}

function emptyEffectsResult(): FieldEffectsResult {
  return {
    materialsFixedAdd: 0,
    durationMultiplier: 1,
    durationAddHours: 0,
    materialsMultiplier: 1,
  };
}

export function formHasFieldEffects(form: FormDefinition): boolean {
  return form.fields.some((field) => Boolean(field.effects?.length));
}

/**
 * Lukee vaikutuksen numeerisen arvon.
 * Järjestys: litteraali value → quantityRef → kentän oma kontekstiavain (fallbackKey).
 */
function resolveEffectValue(
  effect: FieldEffect,
  context: Record<string, number>,
  fallbackKey?: string,
): number | null {
  if (effect.value !== undefined && Number.isFinite(effect.value)) {
    return effect.value;
  }
  if (effect.quantityRef) {
    const legacy = context[effect.quantityRef];
    if (legacy !== undefined && Number.isFinite(legacy)) return legacy;
  }
  if (fallbackKey !== undefined) {
    const own = context[fallbackKey];
    if (own !== undefined && Number.isFinite(own)) return own;
  }
  return null;
}

function applyEffect(
  effect: FieldEffect,
  context: Record<string, number>,
  result: FieldEffectsResult,
  fieldKey: string,
): void {
  switch (effect.type) {
    case 'add_material':
      return;
    case 'add_material_fixed': {
      const amount = resolveEffectValue(effect, context, fieldKey);
      if (amount === null) return;
      result.materialsFixedAdd += amount;
      return;
    }
    case 'multiply_duration': {
      const factor = resolveEffectValue(effect, context, fieldKey);
      if (factor === null || factor <= 0) return;
      result.durationMultiplier *= factor;
      return;
    }
    case 'add_duration': {
      const hours = resolveEffectValue(effect, context, fieldKey);
      if (hours === null) return;
      result.durationAddHours += hours;
      return;
    }
    case 'multiply_materials': {
      const factor = resolveEffectValue(effect, context, fieldKey);
      if (factor === null || factor <= 0) return;
      result.materialsMultiplier *= factor;
      return;
    }
    default:
      return;
  }
}

/** Kerää lisä-/kerroinvaikutukset; sovelletaan vasta laskennan lopussa. */
export function applyFieldEffects(
  form: FormDefinition,
  context: Record<string, number>,
  fieldValues: Record<string, string> = {},
  _products: Product[] = [],
): FieldEffectsResult {
  const result = emptyEffectsResult();
  if (!formHasFieldEffects(form)) return result;

  for (const field of pipelineFieldOrder(form)) {
    if (!field.effects?.length) continue;
    if (!isFieldVisible(field, fieldValues, form, new Set(), context)) continue;
    for (const effect of field.effects) {
      applyEffect(effect, context, result, field.key);
    }
  }

  return result;
}

export function mergeMaterialLines(...groups: WizardLineDraft[][]): WizardLineDraft[] {
  return groups.flat();
}

export function materialLinesTotal(lines: WizardLineDraft[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.product.unitPriceVat0, 0);
}

/** Materiaalit laskennan lopussa: rivit × kerroin + kiinteät lisät. */
export function applyMaterialEffects(
  baseMaterialsVat0: number,
  effects: FieldEffectsResult,
): number {
  return baseMaterialsVat0 * effects.materialsMultiplier + effects.materialsFixedAdd;
}

/** Kesto laskennan lopussa: tunnit × kerroin + lisätunnit. */
export function applyDurationEffects(baseHours: number, effects: FieldEffectsResult): number {
  return baseHours * effects.durationMultiplier + effects.durationAddHours;
}
