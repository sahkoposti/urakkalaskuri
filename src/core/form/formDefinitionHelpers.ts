import { extractFormulaIdentifiers } from '@/src/core/form/formula/evaluator';
import type { FieldType, FormDefinition, FormField, FormPage } from '@/src/core/form/types';

type LegacyFormField = FormField & { pageId?: string; sortOrder?: number };

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
    if (field.type === 'computed' && field.allowManualOverride === undefined) {
      return { ...field, allowManualOverride: true };
    }
    return field;
  });
}

export function normalizeFormDefinition(raw: unknown): FormDefinition {
  const form = (raw ?? {}) as Partial<FormDefinition>;
  const legacyFields = (form.fields ?? []) as LegacyFormField[];

  const pages = isLegacyForm(form)
    ? migrateLegacyPages(form)
    : (form.pages ?? []).map((page) => ({ ...page, fieldIds: [...(page.fieldIds ?? [])] }));

  const fields = stripLegacyFieldProps(legacyFields);

  return {
    id: form.id ?? 'default',
    name: form.name ?? 'Peruslaskenta',
    version: typeof form.version === 'number' ? form.version : 2,
    pages,
    fields,
    updatedAt: form.updatedAt ?? Date.now(),
  };
}

export function getFieldById(form: FormDefinition, fieldId: string): FormField | undefined {
  return form.fields.find((field) => field.id === fieldId);
}

export function sortedGlobalFields(form: FormDefinition): FormField[] {
  return [...form.fields].sort((a, b) => a.label.localeCompare(b.label, 'fi'));
}

export function fieldsForPage(form: FormDefinition, pageId: string): FormField[] {
  const page = form.pages.find((item) => item.id === pageId);
  if (!page) return [];
  return (page.fieldIds ?? [])
    .map((fieldId) => getFieldById(form, fieldId))
    .filter((field): field is FormField => field !== undefined);
}

export function fieldsNotOnPage(form: FormDefinition, pageId: string): FormField[] {
  const page = form.pages.find((item) => item.id === pageId);
  const assigned = new Set(page?.fieldIds ?? []);
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
  const remaining = [...computed];
  const sorted: FormField[] = [];
  const keysDone = new Set<string>();

  const inputKeys = new Set(
    form.fields.filter((field) => field.type !== 'computed' && field.type !== 'section').map((f) => f.key),
  );

  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const field = remaining[i]!;
      const deps = extractComputedDeps(form, field);
      const ready = deps.every((dep) => keysDone.has(dep) || inputKeys.has(dep));
      if (!ready) continue;
      sorted.push(field);
      keysDone.add(field.key);
      remaining.splice(i, 1);
      progress = true;
      break;
    }
  }

  return [...sorted, ...remaining];
}

function extractComputedDeps(form: FormDefinition, field: FormField): string[] {
  if (!field.formula) return [];
  return extractFormulaIdentifiers(field.formula).filter((ident) => {
    const provider = form.fields.find((item) => item.key === ident);
    return provider?.type === 'computed';
  });
}
