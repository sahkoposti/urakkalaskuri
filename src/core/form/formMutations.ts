import type {
  FieldType,
  FormDefinition,
  FormField,
  FormPage,
  SelectOption,
} from '@/src/core/form/types';

import {
  getFieldById,
  sortedPages,
} from '@/src/core/form/formDefinitionHelpers';
import { slugifyKey } from '@/src/core/form/formKeyUtils';
import { isSystemFieldHiddenFromUi } from '@/src/core/form/systemFields';

export { slugifyKey, sanitizeKeyInput } from '@/src/core/form/formKeyUtils';

export {
  collectKnownFormulaIdentifiers,
  fieldsAvailableForPage,
  fieldsForPage,
  wizardFieldsForPage,
  getFieldById,
  normalizeFormDefinition,
  pagesUsingField,
  pipelineFieldOrder,
  sortedGlobalFields,
  sortedPages,
  sortedSystemFields,
  sortedUserFields,
  unknownFormulaIdentifiers,
} from '@/src/core/form/formDefinitionHelpers';
export { isSystemField, isSystemFieldHiddenFromUi, restoreSystemField } from '@/src/core/form/systemFields';

export const EDITABLE_FIELD_TYPES: FieldType[] = [
  'number',
  'text',
  'select',
  'boolean',
  'product_select',
  'computed',
  'section',
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: 'Numero',
  text: 'Teksti',
  select: 'Valintalista',
  boolean: 'Kyllä/Ei',
  product_select: 'Tuotelista',
  computed: 'Laskenta',
  section: 'Otsikko',
};

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isSystemPage(page: FormPage): boolean {
  return page.system === 'customer';
}

export function uniqueFieldKey(form: FormDefinition, baseKey: string, excludeFieldId?: string): string {
  const taken = new Set(
    form.fields.filter((field) => field.id !== excludeFieldId).map((field) => field.key),
  );
  if (!taken.has(baseKey)) return baseKey;
  let index = 2;
  while (taken.has(`${baseKey}_${index}`)) {
    index += 1;
  }
  return `${baseKey}_${index}`;
}

export function createSelectOption(label = 'Uusi valinta'): SelectOption {
  return {
    label,
    value: '1',
  };
}

export function createField(type: FieldType, form: FormDefinition): FormField {
  const label = type === 'section' ? 'Uusi otsikko' : 'Uusi kenttä';
  const key = uniqueFieldKey(form, slugifyKey(label));

  const base: FormField = {
    id: generateId('field'),
    key,
    label,
    type,
    required: type !== 'section' && type !== 'computed',
    showOnSummary: type !== 'section' && type !== 'computed',
  };

  if (type === 'select') {
    return {
      ...base,
      options: [createSelectOption('Vaihtoehto 1')],
    };
  }

  if (type === 'computed') {
    return {
      ...base,
      required: false,
      showOnSummary: true,
      allowManualOverride: true,
      formula: '',
    };
  }

  if (type === 'number') {
    return { ...base, unit: '' };
  }

  return base;
}

function mapPageFieldIds(
  form: FormDefinition,
  pageId: string,
  updater: (fieldIds: string[]) => string[],
): FormDefinition {
  return {
    ...form,
    pages: form.pages.map((page) =>
      page.id === pageId ? { ...page, fieldIds: updater(page.fieldIds ?? []) } : page,
    ),
    updatedAt: Date.now(),
  };
}

export function addPage(form: FormDefinition, title: string): FormDefinition {
  const pages = sortedPages(form);
  const page: FormPage = {
    id: generateId('page'),
    title: title.trim() || 'Uusi sivu',
    sortOrder: pages.length,
    fieldIds: [],
  };
  return {
    ...form,
    pages: [...form.pages, page],
    updatedAt: Date.now(),
  };
}

export function updatePage(form: FormDefinition, pageId: string, patch: Partial<FormPage>): FormDefinition {
  return {
    ...form,
    pages: form.pages.map((page) => (page.id === pageId ? { ...page, ...patch } : page)),
    updatedAt: Date.now(),
  };
}

export function removePage(form: FormDefinition, pageId: string): FormDefinition {
  const page = form.pages.find((item) => item.id === pageId);
  if (!page || isSystemPage(page)) {
    return form;
  }
  return {
    ...form,
    pages: form.pages.filter((item) => item.id !== pageId),
    updatedAt: Date.now(),
  };
}

export function movePage(form: FormDefinition, pageId: string, direction: -1 | 1): FormDefinition {
  const pages = sortedPages(form);
  const index = pages.findIndex((page) => page.id === pageId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= pages.length) {
    return form;
  }
  const next = [...pages];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return {
    ...form,
    pages: next.map((page, sortOrder) => ({ ...page, sortOrder })),
    updatedAt: Date.now(),
  };
}

/** Sivut, joille uuden kentän voi sijoittaa (myös Asiakas). */
export function pagesAssignableForNewField(form: FormDefinition): FormPage[] {
  return sortedPages(form);
}

export function insertField(form: FormDefinition, field: FormField, pageId?: string): FormDefinition {
  const existing = getFieldById(form, field.id);
  const next: FormDefinition = existing
    ? updateField(form, field)
    : {
        ...form,
        fields: [...form.fields, field],
        updatedAt: Date.now(),
      };
  if (!pageId) return next;
  const page = next.pages.find((item) => item.id === pageId);
  if (!page) return next;
  return addFieldToPage(next, pageId, field.id);
}

export function addField(form: FormDefinition, type: FieldType, pageId?: string): FormDefinition {
  return insertField(form, createField(type, form), pageId);
}

export function buildDuplicatedField(form: FormDefinition, fieldId: string): FormField | null {
  const source = getFieldById(form, fieldId);
  if (!source || source.systemKey) return null;
  return {
    ...source,
    id: generateId('field'),
    label: `${source.label} (kopio)`,
    key: uniqueFieldKey(form, `${source.key}_kopio`),
    options: source.options?.map((option) => ({ ...option })),
  };
}

export function updateField(form: FormDefinition, updated: FormField): FormDefinition {
  const existing = getFieldById(form, updated.id);
  if (existing && isSystemFieldHiddenFromUi(existing)) return form;
  return {
    ...form,
    fields: form.fields.map((field) => (field.id === updated.id ? updated : field)),
    updatedAt: Date.now(),
  };
}

export function duplicateField(form: FormDefinition, fieldId: string): FormDefinition {
  const copy = buildDuplicatedField(form, fieldId);
  if (!copy) return form;
  return insertField(form, copy);
}

export function removeField(form: FormDefinition, fieldId: string): FormDefinition {
  const target = getFieldById(form, fieldId);
  if (!target || target.systemKey) return form;
  return {
    ...form,
    fields: form.fields.filter((field) => field.id !== fieldId),
    pages: form.pages.map((page) => ({
      ...page,
      fieldIds: (page.fieldIds ?? []).filter((id) => id !== fieldId),
    })),
    updatedAt: Date.now(),
  };
}

export function addFieldToPage(form: FormDefinition, pageId: string, fieldId: string): FormDefinition {
  const field = getFieldById(form, fieldId);
  if (!field || isSystemFieldHiddenFromUi(field)) return form;
  const withoutElsewhere = {
    ...form,
    pages: form.pages.map((page) => ({
      ...page,
      fieldIds: (page.fieldIds ?? []).filter((id) => id !== fieldId),
    })),
    updatedAt: Date.now(),
  };
  return mapPageFieldIds(withoutElsewhere, pageId, (fieldIds) =>
    fieldIds.includes(fieldId) ? fieldIds : [...fieldIds, fieldId],
  );
}

export function removeFieldFromPage(form: FormDefinition, pageId: string, fieldId: string): FormDefinition {
  return mapPageFieldIds(form, pageId, (fieldIds) => fieldIds.filter((id) => id !== fieldId));
}

export function moveFieldOnPage(
  form: FormDefinition,
  pageId: string,
  fieldId: string,
  direction: -1 | 1,
): FormDefinition {
  const page = form.pages.find((item) => item.id === pageId);
  if (!page) return form;
  const fieldIds = [...(page.fieldIds ?? [])];
  const index = fieldIds.indexOf(fieldId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= fieldIds.length) {
    return form;
  }
  [fieldIds[index], fieldIds[targetIndex]] = [fieldIds[targetIndex], fieldIds[index]];
  return mapPageFieldIds(form, pageId, () => fieldIds);
}

export function formsEqual(a: FormDefinition, b: FormDefinition): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
