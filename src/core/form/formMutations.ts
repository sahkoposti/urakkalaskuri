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

export {
  fieldsForPage,
  fieldsNotOnPage,
  getFieldById,
  normalizeFormDefinition,
  pagesUsingField,
  pipelineFieldOrder,
  sortedGlobalFields,
  sortedPages,
} from '@/src/core/form/formDefinitionHelpers';

export const EDITABLE_FIELD_TYPES: FieldType[] = [
  'number',
  'text',
  'select',
  'boolean',
  'computed',
  'section',
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: 'Numero',
  text: 'Teksti',
  select: 'Valinta',
  boolean: 'Kyllä/Ei',
  product_quantity: 'Tuote + määrä',
  product_select: 'Tuotevalinta',
  computed: 'Laskettu',
  section: 'Otsikko',
};

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isSystemPage(page: FormPage): boolean {
  return page.system === 'customer' || page.system === 'materials';
}

export function slugifyKey(label: string): string {
  return (
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/å/g, 'a')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_') || 'kentta'
  );
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

export function defaultExportKey(fieldKey: string): string {
  return `${fieldKey}_kerroin`;
}

export function createSelectOption(label = 'Uusi valinta'): SelectOption {
  const value = slugifyKey(label);
  return {
    label,
    value,
    multiplier: 1,
    exportKey: 'kerroin',
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
      options: [
        {
          label: 'Vaihtoehto 1',
          value: 'vaihtoehto_1',
          multiplier: 1,
          exportKey: defaultExportKey(key),
        },
      ],
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

export function addField(form: FormDefinition, type: FieldType): FormDefinition {
  const field = createField(type, form);
  return {
    ...form,
    fields: [...form.fields, field],
    updatedAt: Date.now(),
  };
}

export function updateField(form: FormDefinition, updated: FormField): FormDefinition {
  return {
    ...form,
    fields: form.fields.map((field) => (field.id === updated.id ? updated : field)),
    updatedAt: Date.now(),
  };
}

export function removeField(form: FormDefinition, fieldId: string): FormDefinition {
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
  if (!getFieldById(form, fieldId)) return form;
  return mapPageFieldIds(form, pageId, (fieldIds) =>
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
