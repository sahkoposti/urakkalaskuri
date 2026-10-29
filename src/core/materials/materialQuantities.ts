import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import { isFieldVisible } from '@/src/core/form/fieldVisibility';
import { fieldsForPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import { findProductById, getSelectedProductId } from '@/src/core/form/productFieldUtils';
import { resolveTargetPrint } from '@/src/core/form/printSettings';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { MaterialQuantityRow, Product, StructureLine } from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';
import { fieldValuesEqual } from '@/src/core/wizard/wizardDraftHelpers';

/**
 * Käyttäjän syöttämä enimmäismäärä. Esitäytön kaava-arvoa ei rajata tähän.
 * PR #41:n tiukkaa lukuparseria ei ole tällä haaralla (`parseNumber` on parseFloat).
 */
export const MATERIAL_QUANTITY_MAX = 100_000;

const EMPTY_DISPLAY = '–';

export type MaterialQuantityPatch = Partial<
  Pick<MaterialQuantityRow, 'productName' | 'quantity' | 'unit' | 'productId'>
>;

function isEmptyDisplay(value: string | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === EMPTY_DISPLAY;
}

/** Näyttömerkkijono (snapshot) → positiivinen luku. Yksikkö ja € hylätään. */
function parseDisplayQuantity(value: string, unit?: string): number | undefined {
  let text = value.trim().replace(/[\u00a0\u202f]/g, ' ');
  if (isEmptyDisplay(text) || text.includes('€')) return undefined;
  if (unit && text.endsWith(` ${unit}`)) text = text.slice(0, -(unit.length + 1)).trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return undefined;
  const parsed = Number(text.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function formulaContext(
  form: FormDefinition,
  line: StructureLine,
  products: Product[],
): Record<string, number> {
  try {
    return previewFormContext(form, line.fieldValues ?? {}, [], products, defaultSettings);
  } catch {
    return {};
  }
}

function readQuantity(
  quantityKey: string,
  form: FormDefinition,
  line: StructureLine,
  context: Record<string, number>,
): { quantity: number; unit?: string } | undefined {
  const source = form.fields.find((item) => item.key === quantityKey);
  if (!source) return undefined;
  const unit = typeof source.unit === 'string' && source.unit.trim() ? source.unit.trim() : undefined;
  if (unit?.includes('€')) return undefined;

  const saved = Array.isArray(line.snapshot?.fields)
    ? line.snapshot.fields.find((item) => item?.key === quantityKey)
    : undefined;
  if (saved && typeof saved.value === 'string' && !isEmptyDisplay(saved.value)) {
    const fromSnapshot = parseDisplayQuantity(saved.value, saved.unit ?? unit);
    if (fromSnapshot === undefined) return undefined;
    return unit ? { quantity: fromSnapshot, unit } : { quantity: fromSnapshot };
  }

  const recomputed = context[quantityKey];
  if (typeof recomputed !== 'number' || !Number.isFinite(recomputed) || recomputed <= 0) return undefined;
  return unit ? { quantity: recomputed, unit } : { quantity: recomputed };
}

function paintCandidates(form: FormDefinition): FormField[] {
  const seen = new Set<string>();
  const candidates: FormField[] = [];
  for (const page of sortedPages(form)) {
    for (const field of fieldsForPage(form, page.id)) {
      if (seen.has(field.id)) continue;
      seen.add(field.id);
      if (field.type !== 'product_select') continue;
      const resolved = resolveTargetPrint(field, 'urakkakortti', form);
      if (!resolved?.quantityKey || resolved.group !== 'maali') continue;
      candidates.push(field);
    }
  }
  return candidates;
}

/**
 * Esitäyttö: urakkakortin `maali` + kelvollinen `quantityKey`, lomakejärjestyksessä.
 * Määrä: tallennettu snapshot ensin, muuten sama kaavakonteksti kuin P1/P4 (`previewFormContext`).
 * Asetuksia, käänteistä ALV:tä ja matka-aikaa ei ole tässä signatuurissa, joten uudelleenlasku käyttää oletusasetuksia.
 */
export function prefillMaterialQuantities(
  line: StructureLine,
  form: FormDefinition | undefined,
  products: Product[],
): MaterialQuantityRow[] {
  try {
    if (!line || !form || !Array.isArray(form.fields) || !Array.isArray(form.pages)) return [];
    const candidates = paintCandidates(form);
    if (candidates.length === 0) return [];
    const catalog = products ?? [];
    const context = formulaContext(form, line, catalog);
    const fieldValues = line.fieldValues ?? {};
    const rows: MaterialQuantityRow[] = [];
    for (const field of candidates) {
      if (!isFieldVisible(field, fieldValues, form, new Set(), context)) continue;
      const productId = getSelectedProductId(fieldValues, field.key, field);
      if (!productId) continue;
      const product = findProductById(catalog, productId);
      const productName = product?.name?.trim();
      if (!product || !productName) continue;
      const quantityKey = resolveTargetPrint(field, 'urakkakortti', form)?.quantityKey;
      if (!quantityKey) continue;
      const amount = readQuantity(quantityKey, form, line, context);
      if (!amount) continue;
      const row: MaterialQuantityRow = {
        id: `form:${field.key}`,
        productId: product.id,
        productName,
        quantity: amount.quantity,
        source: 'form',
        fieldKey: field.key,
      };
      if (amount.unit) row.unit = amount.unit;
      rows.push(row);
    }
    return rows;
  } catch {
    return [];
  }
}

/**
 * `existing` puuttuu → esitäyttö. Muuten manuaalirivit säilyvät.
 * Lomakerivit korvataan tuoreella esitäytöllä. Muokattu lomakerivi on `source: 'manual'`
 * ja säilyttää `fieldKey`:n, jolloin saman kentän esitäyttö ohitetaan. Tunnukset pysyvät.
 */
export function syncMaterialQuantities(
  existing: MaterialQuantityRow[] | undefined,
  prefill: MaterialQuantityRow[],
): MaterialQuantityRow[] {
  const fresh = (prefill ?? []).map((row) => ({ ...row }));
  if (existing === undefined) return fresh;

  const suppressed = new Set(
    existing
      .filter((row) => row?.source === 'manual' && typeof row.fieldKey === 'string' && row.fieldKey)
      .map((row) => row.fieldKey as string),
  );
  const prefillByField = new Map<string, MaterialQuantityRow>();
  for (const row of fresh) {
    if (!row.fieldKey || suppressed.has(row.fieldKey)) continue;
    prefillByField.set(row.fieldKey, row);
  }

  const used = new Set<string>();
  const result: MaterialQuantityRow[] = [];
  for (const row of existing) {
    if (!row) continue;
    if (row.source === 'manual') {
      result.push({ ...row });
      continue;
    }
    if (row.source !== 'form' || !row.fieldKey || !prefillByField.has(row.fieldKey)) continue;
    const next = prefillByField.get(row.fieldKey)!;
    used.add(row.fieldKey);
    result.push({ ...next, id: row.id, source: 'form', fieldKey: row.fieldKey });
  }
  for (const row of fresh) {
    if (!row.fieldKey || used.has(row.fieldKey) || suppressed.has(row.fieldKey)) continue;
    result.push({ ...row });
  }
  return result;
}

export function editMaterialQuantity(
  rows: MaterialQuantityRow[],
  id: string,
  patch: MaterialQuantityPatch,
): MaterialQuantityRow[] {
  return (rows ?? []).map((row) => {
    if (row.id !== id) return row;
    const next: MaterialQuantityRow = { ...row, ...patch };
    if (row.source === 'form') next.source = 'manual';
    if (row.fieldKey) next.fieldKey = row.fieldKey;
    return next;
  });
}

let materialRowSequence = 0;

function createMaterialRowId(): string {
  materialRowSequence += 1;
  return `mq-${materialRowSequence}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addManualMaterialRow(rows: MaterialQuantityRow[]): MaterialQuantityRow[] {
  return [
    ...(rows ?? []).map((row) => ({ ...row })),
    { id: createMaterialRowId(), productName: '', quantity: 0, source: 'manual' },
  ];
}

export function removeMaterialRow(rows: MaterialQuantityRow[], id: string): MaterialQuantityRow[] {
  return (rows ?? []).filter((row) => row.id !== id).map((row) => ({ ...row }));
}

/** Tiukka desimaali: pilkku tai piste, enintään 2 desimaalia, ei eksponenttia eikä välilyöntejä. */
export function parseQuantityInput(text: string): number | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0 || value > MATERIAL_QUANTITY_MAX) return null;
  return value;
}

/** fi-FI-pilkku, ilman tuhaterotinta (`49,5`, `100000`), jotta merkkijono pysyy tiukkana desimaalina. */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const sign = rounded < 0 ? '-' : '';
  const [intPart, fracPart] = Math.abs(rounded).toFixed(2).split('.');
  const decimals = fracPart.replace(/0+$/, '');
  return decimals ? `${sign}${intPart},${decimals}` : `${sign}${intPart}`;
}

export function quantityInputError(text: string): string | null {
  if (parseQuantityInput(text) != null) return null;
  if (!text.trim()) return 'Anna määrä';
  return 'Tarkista määrä';
}

/** Tallentamattomat tai kelvottomat rivit estävät Yhteenveto-napin. Puuttuva avain ei estä. */
export function materialQuantitiesBlockFinish(rows: MaterialQuantityRow[] | undefined): boolean {
  if (!rows) return false;
  return rows.some(
    (row) =>
      !row.productName.trim() ||
      !Number.isFinite(row.quantity) ||
      row.quantity <= 0 ||
      row.quantity > MATERIAL_QUANTITY_MAX,
  );
}

/**
 * Tallennetut rivit, jos avain on olemassa (myös `[]`). Muuten esitäyttö.
 * PDF käyttää tätä vain kun avain on jo kirjoitettu; katso urakkakortin päätös.
 */
export function effectiveMaterialQuantities(
  line: StructureLine,
  form: FormDefinition | undefined,
  products: Product[],
): MaterialQuantityRow[] {
  if (!line) return [];
  if (line.materialQuantities !== undefined) return line.materialQuantities.map((row) => ({ ...row }));
  return prefillMaterialQuantities(line, form, products);
}

/**
 * Lomakkeen paluu: kenttien muuttuessa synkronoidaan määrät.
 * Tyhjä esitäyttö ei materialisoi `[]`-avainta, jotta T9-varamateriaalit säilyvät.
 * Sama kenttäarvo ja puuttuva avain säilyttää muistissa jo synkatut rivit.
 */
export function mergeStructureLineMaterials(
  previous: StructureLine | undefined,
  incoming: StructureLine,
  form: FormDefinition | undefined,
  products: Product[],
): StructureLine {
  if (!previous) return incoming;
  if (fieldValuesEqual(previous.fieldValues, incoming.fieldValues)) {
    if (incoming.materialQuantities === undefined && previous.materialQuantities !== undefined) {
      return {
        ...incoming,
        materialQuantities: previous.materialQuantities.map((row) => ({ ...row })),
      };
    }
    return incoming;
  }
  const existing =
    incoming.materialQuantities !== undefined ? incoming.materialQuantities : previous.materialQuantities;
  const prefill = prefillMaterialQuantities(incoming, form, products);
  const synced = syncMaterialQuantities(existing, prefill);
  if (synced.length === 0 && existing === undefined) return incoming;
  return { ...incoming, materialQuantities: synced };
}

/** Kelvolliset rivit. Ei-taulukko → `undefined` (avain puuttuu). Ei heitä. */
export function sanitizeMaterialQuantities(raw: unknown): MaterialQuantityRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows: MaterialQuantityRow[] = [];
  for (const item of raw) {
    const row = sanitizeMaterialQuantityRow(item);
    if (row) rows.push(row);
  }
  return rows;
}

function sanitizeMaterialQuantityRow(raw: unknown): MaterialQuantityRow | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== 'string' || item.id.trim() === '') return undefined;
  if (typeof item.productName !== 'string') return undefined;
  if (typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0) return undefined;
  if (item.source !== 'form' && item.source !== 'manual') return undefined;
  const row: MaterialQuantityRow = {
    id: item.id,
    productName: item.productName,
    quantity: item.quantity,
    source: item.source,
  };
  if (typeof item.productId === 'string' && item.productId) row.productId = item.productId;
  if (typeof item.unit === 'string') row.unit = item.unit;
  if (typeof item.fieldKey === 'string' && item.fieldKey) row.fieldKey = item.fieldKey;
  return row;
}

export function materialQuantitiesSignature(lines: StructureLine[]): string {
  return JSON.stringify(lines.map((line) => (line.materialQuantities === undefined ? null : line.materialQuantities)));
}
