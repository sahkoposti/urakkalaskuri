import { normalizeVisibilityConditionValue } from '@/src/core/form/fieldVisibility';
import {
  extractFormulaIdentifiers,
  FORMULA_FUNCTIONS,
} from '@/src/core/form/formula/evaluator';
import { computedFieldDependencies } from '@/src/core/form/formula/formulaDependencies';
import { slugifyKey } from '@/src/core/form/formKeyUtils';
import {
  createSystemFields,
  isSystemFieldHiddenFromUi,
  LEGACY_KEY_MAP,
  MATERIALS_CONTEXT_KEY,
  mergeSystemFields,
  migrateFormulaKeys,
  PIPELINE_CONTEXT_KEYS,
  REMOVED_SYSTEM_FIELD_IDS,
} from '@/src/core/form/systemFields';
import type { FormDefinition, FormField, FormPage, SelectOption } from '@/src/core/form/types';

const ALLOWED_FORMULA_IDENTIFIERS = new Set([MATERIALS_CONTEXT_KEY]);

export function collectKnownFormulaIdentifiers(form: FormDefinition): Set<string> {
  const known = new Set<string>();
  for (const field of form.fields) {
    known.add(field.key);
  }
  return known;
}

function isKnownFormulaIdentifier(ident: string, known: Set<string>): boolean {
  if (FORMULA_FUNCTIONS.has(ident)) return true;
  if (ident.startsWith('asetukset.') || ident.startsWith('settings.')) return true;
  if (ALLOWED_FORMULA_IDENTIFIERS.has(ident)) return true;
  if (known.has(ident)) return true;
  const base = ident.split('.')[0];
  return base !== ident && known.has(base);
}

/** Palauttaa kaavassa olevat tunnisteet, joita ei löydy lomakkeesta. */
export function unknownFormulaIdentifiers(
  form: FormDefinition,
  formula: string,
): string[] {
  const known = collectKnownFormulaIdentifiers(form);
  return extractFormulaIdentifiers(formula).filter((ident) => !isKnownFormulaIdentifier(ident, known));
}
type LegacySelectOption = SelectOption & {
  multiplier?: number;
  exportValue?: number;
  exportKey?: string;
};

type LegacyFormField = FormField & {
  pageId?: string;
  sortOrder?: number;
  options?: LegacySelectOption[];
};

function migrateSelectFields(fields: FormField[]): FormField[] {
  const exportKeyToFieldKey = new Map<string, string>();
  for (const field of fields) {
    if (field.type !== 'select') continue;
    for (const option of (field.options ?? []) as LegacySelectOption[]) {
      if (option.exportKey?.trim()) {
        exportKeyToFieldKey.set(option.exportKey.trim(), field.key);
      }
    }
  }

  return fields.map((field) => {
    let next: FormField = field;

    if (field.type === 'select' && field.options) {
      let debugExampleValue = field.debugExampleValue;
      if (debugExampleValue) {
        const legacy = (field.options as LegacySelectOption[]).find(
          (option) => option.value === debugExampleValue,
        );
        if (legacy?.multiplier !== undefined) {
          debugExampleValue = String(legacy.multiplier);
        }
      }

      next = {
        ...next,
        debugExampleValue,
        options: (field.options as LegacySelectOption[]).map((option) => {
          const numeric = option.multiplier ?? option.exportValue;
          if (numeric !== undefined) {
            return { label: option.label, value: String(numeric) };
          }
          return { label: option.label, value: option.value };
        }),
      };
    }

    if (field.formula && exportKeyToFieldKey.size > 0) {
      let formula = field.formula;
      for (const [exportKey, fieldKey] of exportKeyToFieldKey) {
        formula = formula.replaceAll(exportKey, fieldKey);
      }
      next = { ...next, formula };
    }

    return next;
  });
}

function isLegacyForm(raw: Partial<FormDefinition>): boolean {
  const fields = raw.fields as LegacyFormField[] | undefined;
  if (!fields?.length) return false;
  return fields.some((field) => field.pageId !== undefined);
}

function migrateLegacyPages(raw: Partial<FormDefinition>): FormPage[] {
  const pages = [...(raw.pages ?? [])];
  const fields = (raw.fields ?? []) as LegacyFormField[];

  return pages.map((page) => {
    if (page.fieldIds && page.fieldIds.length > 0) {
      return { ...page, fieldIds: [...page.fieldIds] };
    }

    const legacyIds = fields
      .filter((field) => field.pageId === page.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((field) => field.id);

    return { ...page, fieldIds: legacyIds };
  });
}

function stripLegacyFieldProps(fields: LegacyFormField[]): FormField[] {
  return fields.map(({ pageId: _pageId, sortOrder: _sortOrder, ...field }) => {
    if (field.type === 'computed' && field.allowManualOverride === undefined && !field.systemKey) {
      return { ...field, allowManualOverride: true };
    }
    return field;
  });
}

function normalizeFieldKeys(fields: FormField[]): FormField[] {
  return fields.map((field) => {
    const mapped = LEGACY_KEY_MAP[field.key];
    const key = mapped ?? (/^[a-z0-9_]+$/.test(field.key) ? field.key : slugifyKey(field.key));
    const rawType = String(field.type);
    const type = (rawType === 'product_quantity' ? 'product_select' : field.type) as FormField['type'];
    const effects = field.effects
      ?.filter((effect) => effect.type !== 'add_material')
      .map((effect) => ({ ...effect }));
    const showWhen = field.showWhen?.fieldKey
      ? {
          ...field.showWhen,
          value: normalizeVisibilityConditionValue(field.showWhen.value),
        }
      : field.showWhen;
    return {
      ...field,
      key,
      type,
      formula: field.formula ? migrateFormulaKeys(field.formula) : field.formula,
      effects: effects && effects.length > 0 ? effects : undefined,
      showWhen,
    };
  });
}

function dedupePageFieldAssignments(pages: FormPage[]): FormPage[] {
  const seen = new Set<string>();
  return pages.map((page) => ({
    ...page,
    fieldIds: (page.fieldIds ?? []).filter((fieldId) => {
      if (seen.has(fieldId)) return false;
      seen.add(fieldId);
      return true;
    }),
  }));
}

/** Vanha käyttäjäkenttä tyoryhma_kesto_pv → järjestelmäkentän id sivulla. */
function remapPromotedSystemFieldIds(pages: FormPage[], rawFields: FormField[]): FormPage[] {
  const reservedKeys = new Set([
    ...createSystemFields().map((field) => field.key),
    ...PIPELINE_CONTEXT_KEYS,
  ]);
  const keyToSystemId = new Map(createSystemFields().map((field) => [field.key, field.id]));
  const oldIdToSystemId = new Map<string, string>();

  for (const field of rawFields) {
    if (field.systemKey || !reservedKeys.has(field.key) || PIPELINE_CONTEXT_KEYS.has(field.key)) {
      continue;
    }
    const systemId = keyToSystemId.get(field.key);
    if (systemId) oldIdToSystemId.set(field.id, systemId);
  }

  if (oldIdToSystemId.size === 0) return pages;

  return pages.map((page) => ({
    ...page,
    fieldIds: (page.fieldIds ?? []).map((fieldId) => oldIdToSystemId.get(fieldId) ?? fieldId),
  }));
}

/** Poistaa sivuilta poistetut / tuntemattomat kenttä-id:t. */
function pruneMissingFieldIds(pages: FormPage[], fields: FormField[]): FormPage[] {
  const knownIds = new Set(fields.map((field) => field.id));
  return pages.map((page) => ({
    ...page,
    fieldIds: (page.fieldIds ?? []).filter(
      (fieldId) => knownIds.has(fieldId) && !REMOVED_SYSTEM_FIELD_IDS.has(fieldId),
    ),
  }));
}

/** Vanha kovakoodattu Materiaalit-sivu muuttuu tavalliseksi sivuksi. */
function migrateMaterialsSystemPages(pages: FormPage[]): FormPage[] {
  return pages.map((page) => {
    if (page.system !== 'materials') return page;
    const { system: _system, ...rest } = page;
    return rest;
  });
}

export function normalizeFormDefinition(raw: unknown): FormDefinition {
  const form = (raw ?? {}) as Partial<FormDefinition>;
  const legacyFields = (form.fields ?? []) as LegacyFormField[];

  const normalizedUserFields = normalizeFieldKeys(
    migrateSelectFields(stripLegacyFieldProps(legacyFields)),
  );

  const pages = dedupePageFieldAssignments(
    remapPromotedSystemFieldIds(
      migrateMaterialsSystemPages(
        isLegacyForm(form)
          ? migrateLegacyPages(form)
          : (form.pages ?? []).map((page) => ({ ...page, fieldIds: [...(page.fieldIds ?? [])] })),
      ),
      normalizedUserFields,
    ),
  );

  const fields = mergeSystemFields(normalizedUserFields);

  return {
    id: form.id ?? 'default',
    name: form.name ?? 'Peruslaskenta',
    version: typeof form.version === 'number' ? form.version : 3,
    pages: pruneMissingFieldIds(pages, fields),
    fields,
    updatedAt: form.updatedAt ?? Date.now(),
  };
}

export function getFieldById(form: FormDefinition, fieldId: string): FormField | undefined {
  return form.fields.find((field) => field.id === fieldId);
}

export function sortedGlobalFields(form: FormDefinition): FormField[] {
  return [...form.fields]
    .filter((field) => !isSystemFieldHiddenFromUi(field))
    .sort((a, b) => a.label.localeCompare(b.label, 'fi'));
}

export function sortedUserFields(form: FormDefinition): FormField[] {
  return sortedGlobalFields(form).filter((field) => !field.systemKey);
}

export function sortedSystemFields(form: FormDefinition): FormField[] {
  return sortedGlobalFields(form).filter((field) => field.systemKey);
}

export function assignedFieldIds(form: FormDefinition): Set<string> {
  const ids = new Set<string>();
  for (const page of form.pages) {
    for (const fieldId of page.fieldIds ?? []) {
      ids.add(fieldId);
    }
  }
  return ids;
}

export function fieldsForPage(form: FormDefinition, pageId: string): FormField[] {
  const page = form.pages.find((item) => item.id === pageId);
  if (!page) return [];
  return (page.fieldIds ?? [])
    .map((fieldId) => getFieldById(form, fieldId))
    .filter((field): field is FormField => field !== undefined)
    .filter((field) => !isSystemFieldHiddenFromUi(field));
}

/** Kentät joita voi lisätä tälle sivulle (ei vielä millään sivulla). */
export function fieldsAvailableForPage(form: FormDefinition, _pageId: string): FormField[] {
  const assigned = assignedFieldIds(form);
  return sortedGlobalFields(form).filter((field) => !assigned.has(field.id));
}

export function pagesUsingField(form: FormDefinition, fieldId: string): FormPage[] {
  return sortedPages(form).filter((page) => (page.fieldIds ?? []).includes(fieldId));
}

export function sortedPages(form: FormDefinition): FormPage[] {
  return [...form.pages].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function pipelineFieldOrder(form: FormDefinition): FormField[] {
  const appearance = new Map<string, number>();
  let index = 0;

  for (const page of sortedPages(form)) {
    for (const fieldId of page.fieldIds ?? []) {
      if (!appearance.has(fieldId)) {
        appearance.set(fieldId, index);
        index += 1;
      }
    }
  }

  for (const field of form.fields) {
    if (!appearance.has(field.id)) {
      appearance.set(field.id, index);
      index += 1;
    }
  }

  const inputs = form.fields.filter((field) => field.type !== 'section' && field.type !== 'computed');
  const computed = form.fields.filter((field) => field.type === 'computed');

  const sortedInputs = [...inputs].sort(
    (a, b) => (appearance.get(a.id) ?? 999) - (appearance.get(b.id) ?? 999),
  );

  const sortedComputed = topologicalComputedFields(form, computed);
  return [...sortedInputs, ...sortedComputed];
}

function topologicalComputedFields(form: FormDefinition, computed: FormField[]): FormField[] {
  if (computed.length === 0) return [];

  const byKey = new Map(computed.map((field) => [field.key, field]));
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const field of computed) {
    inDegree.set(field.key, 0);
    dependents.set(field.key, []);
  }

  for (const field of computed) {
    for (const dep of computedFieldDependencies(form, field)) {
      if (!byKey.has(dep)) continue;
      inDegree.set(field.key, (inDegree.get(field.key) ?? 0) + 1);
      dependents.get(dep)?.push(field.key);
    }
  }

  const queue = computed
    .filter((field) => (inDegree.get(field.key) ?? 0) === 0)
    .sort((a, b) => a.key.localeCompare(b.key, 'fi'));

  const sorted: FormField[] = [];
  while (queue.length > 0) {
    const field = queue.shift()!;
    sorted.push(field);
    for (const nextKey of dependents.get(field.key) ?? []) {
      const nextDegree = (inDegree.get(nextKey) ?? 1) - 1;
      inDegree.set(nextKey, nextDegree);
      if (nextDegree === 0) {
        const nextField = byKey.get(nextKey);
        if (nextField) {
          queue.push(nextField);
          queue.sort((a, b) => a.key.localeCompare(b.key, 'fi'));
        }
      }
    }
  }

  if (sorted.length === computed.length) {
    return sorted;
  }

  const sortedKeys = new Set(sorted.map((field) => field.key));
  return [...sorted, ...computed.filter((field) => !sortedKeys.has(field.key))];
}
