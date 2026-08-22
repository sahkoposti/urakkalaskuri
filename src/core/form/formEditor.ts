import type {
  FieldType,
  FormDefinition,
  FormField,
  FormPage,
  SelectOption,
} from '@/src/core/form/types';

function touch(form: FormDefinition, patch: Partial<FormDefinition>): FormDefinition {
  return {
    ...form,
    ...patch,
    updatedAt: Date.now(),
  };
}

function sortedByOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function reindex<T extends { sortOrder: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, sortOrder: index }));
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function getPageById(form: FormDefinition, pageId: string): FormPage | undefined {
  return form.pages.find((page) => page.id === pageId);
}

export function getFieldById(form: FormDefinition, fieldId: string): FormField | undefined {
  return form.fields.find((field) => field.id === fieldId);
}

export function fieldsForPage(form: FormDefinition, pageId: string): FormField[] {
  return sortedByOrder(form.fields.filter((field) => field.pageId === pageId));
}

export function slugifyKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_äöå]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return slug || 'kentta';
}

export function uniqueFieldKey(form: FormDefinition, base: string, excludeFieldId?: string): string {
  const normalized = slugifyKey(base);
  const taken = (key: string) =>
    form.fields.some((field) => field.key === key && field.id !== excludeFieldId);
  if (!taken(normalized)) return normalized;
  let index = 2;
  while (taken(`${normalized}_${index}`)) {
    index += 1;
  }
  return `${normalized}_${index}`;
}

export function validateFieldKey(
  form: FormDefinition,
  key: string,
  excludeFieldId?: string,
): string | null {
  const trimmed = key.trim();
  if (!trimmed) return 'Anna muuttujanimi.';
  if (!/^[a-z0-9_äöå]+$/.test(trimmed)) {
    return 'Käytä vain pieniä kirjaimia, numeroita ja alaviivaa.';
  }
  if (form.fields.some((field) => field.key === trimmed && field.id !== excludeFieldId)) {
    return 'Muuttujanimi on jo käytössä.';
  }
  return null;
}

export function nextSortOrder(items: { sortOrder: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((item) => item.sortOrder)) + 1;
}

export function addPage(form: FormDefinition, page: FormPage): FormDefinition {
  return touch(form, { pages: [...form.pages, page] });
}

export function updatePage(form: FormDefinition, pageId: string, patch: Partial<FormPage>): FormDefinition {
  return touch(form, {
    pages: form.pages.map((page) => (page.id === pageId ? { ...page, ...patch, id: page.id } : page)),
  });
}

export function removePage(form: FormDefinition, pageId: string): FormDefinition {
  const page = getPageById(form, pageId);
  if (!page || page.system) return form;
  return touch(form, {
    pages: form.pages.filter((item) => item.id !== pageId),
    fields: form.fields.filter((field) => field.pageId !== pageId),
  });
}

export function movePage(
  form: FormDefinition,
  pageId: string,
  direction: -1 | 1,
): FormDefinition {
  const pages = sortedByOrder(form.pages);
  const index = pages.findIndex((page) => page.id === pageId);
  if (index < 0) return form;
  return touch(form, { pages: reindex(moveItem(pages, index, direction)) });
}

export function createPageDraft(id: string, form: FormDefinition, title = 'Uusi sivu'): FormPage {
  return {
    id,
    title,
    sortOrder: nextSortOrder(form.pages),
  };
}

export function addField(form: FormDefinition, field: FormField): FormDefinition {
  return touch(form, { fields: [...form.fields, field] });
}

export function updateFieldInForm(form: FormDefinition, updated: FormField): FormDefinition {
  return touch(form, {
    fields: form.fields.map((field) => (field.id === updated.id ? updated : field)),
  });
}

export function removeField(form: FormDefinition, fieldId: string): FormDefinition {
  return touch(form, {
    fields: form.fields.filter((field) => field.id !== fieldId),
  });
}

export function moveField(
  form: FormDefinition,
  fieldId: string,
  direction: -1 | 1,
): FormDefinition {
  const field = getFieldById(form, fieldId);
  if (!field) return form;
  const pageFields = fieldsForPage(form, field.pageId);
  const index = pageFields.findIndex((item) => item.id === fieldId);
  if (index < 0) return form;
  const reordered = reindex(moveItem(pageFields, index, direction));
  const byId = new Map(reordered.map((item) => [item.id, item]));
  return touch(form, {
    fields: form.fields.map((item) => byId.get(item.id) ?? item),
  });
}

export function createFieldDraft(
  id: string,
  form: FormDefinition,
  pageId: string,
  type: FieldType = 'number',
): FormField {
  const label = 'Uusi kenttä';
  return {
    id,
    pageId,
    key: uniqueFieldKey(form, label),
    label,
    type,
    sortOrder: nextSortOrder(fieldsForPage(form, pageId)),
    required: false,
    showOnSummary: type !== 'section',
  };
}

export function applyFieldType(field: FormField, type: FieldType): FormField {
  const next: FormField = { ...field, type };
  if (type !== 'select') {
    delete next.options;
  } else if (!next.options) {
    next.options = [];
  }
  if (type !== 'computed') {
    delete next.formula;
  }
  if (type !== 'product_select' && type !== 'product_quantity') {
    delete next.productId;
  }
  if (type === 'section') {
    next.required = false;
    next.showOnSummary = false;
    delete next.effects;
  }
  return next;
}

export function createSelectOption(label = 'Uusi valinta'): SelectOption {
  return {
    label,
    value: slugifyKey(label),
  };
}

export function setOptionsExportKey(field: FormField, exportKey: string): FormField {
  const trimmed = exportKey.trim();
  return {
    ...field,
    options: (field.options ?? []).map((option) => ({
      ...option,
      exportKey: trimmed || undefined,
    })),
  };
}
