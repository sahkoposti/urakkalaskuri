import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import {
  addField,
  addFieldToPage,
  addPage,
  duplicateField,
  EDITABLE_FIELD_TYPES,
  fieldsAvailableForPage,
  fieldsForPage,
  isSystemPage,
  moveFieldOnPage,
  movePage,
  removeField,
  removePage,
  slugifyKey,
  sanitizeKeyInput,
  uniqueFieldKey,
  unknownFormulaIdentifiers,
} from '../src/core/form/formMutations';
import { isSystemField, restoreSystemField } from '../src/core/form/systemFields';

describe('formMutations', () => {
  test('slugifyKey converts finnish labels', () => {
    expect(slugifyKey('Laudoitustyyppi')).toBe('laudoitustyyppi');
    expect(slugifyKey('Kiinteä seinäpinta')).toBe('kiintea_seinapinta');
  });

  test('sanitizeKeyInput allows empty while editing', () => {
    expect(sanitizeKeyInput('')).toBe('');
    expect(sanitizeKeyInput('   ')).toBe('');
  });

  test('sanitizeKeyInput slugifies non-empty input', () => {
    expect(sanitizeKeyInput('Pinta Ala')).toBe('pintaala');
    expect(sanitizeKeyInput('Määrä')).toBe('maara');
  });

  test('sanitizeKeyInput preserves underscores while typing', () => {
    expect(sanitizeKeyInput('pinta_')).toBe('pinta_');
    expect(sanitizeKeyInput('pinta_ala')).toBe('pinta_ala');
    expect(sanitizeKeyInput('kiintea_seinapinta_ala_m2')).toBe('kiintea_seinapinta_ala_m2');
  });

  test('slugifyKey defaults empty label to kentta', () => {
    expect(slugifyKey('')).toBe('kentta');
  });

  test('addPage appends with empty fieldIds', () => {
    const form = createDefaultFormDefinition();
    const next = addPage(form, 'Työvaiheet');
    expect(next.pages).toHaveLength(form.pages.length + 1);
    const added = next.pages.find((page) => page.title === 'Työvaiheet');
    expect(added?.sortOrder).toBe(form.pages.length);
    expect(added?.fieldIds).toEqual([]);
  });

  test('removePage keeps global fields', () => {
    const form = createDefaultFormDefinition();
    const withPage = addPage(form, 'Testisivu');
    const pageId = withPage.pages.find((page) => page.title === 'Testisivu')!.id;
    const withField = addField(withPage, 'number');
    const created = withField.fields.at(-1)!;
    const onPage = addFieldToPage(withField, pageId, created.id);

    const cleaned = removePage(onPage, pageId);
    expect(cleaned.pages.some((page) => page.id === pageId)).toBe(false);
    expect(cleaned.fields.some((field) => field.id === created.id)).toBe(true);
  });

  test('does not remove system pages', () => {
    const form = createDefaultFormDefinition();
    const customerPage = form.pages.find((page) => page.system === 'customer')!;
    const next = removePage(form, customerPage.id);
    expect(next.pages).toHaveLength(form.pages.length);
  });

  test('movePage swaps sort order', () => {
    const form = createDefaultFormDefinition();
    const pages = [...form.pages].sort((a, b) => a.sortOrder - b.sortOrder);
    const firstId = pages[0].id;
    const secondId = pages[1].id;
    const moved = movePage(form, firstId, 1);
    const reordered = [...moved.pages].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(reordered[0].id).toBe(secondId);
    expect(reordered[1].id).toBe(firstId);
  });

  test('addField creates global select field', () => {
    const form = createDefaultFormDefinition();
    const next = addField(form, 'select');
    const created = next.fields.at(-1);
    expect(created?.type).toBe('select');
    expect(created?.options?.length).toBe(1);
    expect(created?.options?.[0].value).toBe('1');
  });

  test('uniqueFieldKey avoids collisions', () => {
    const form = createDefaultFormDefinition();
    expect(uniqueFieldKey(form, 'kiintea_seinapinta_ala_m2')).toBe('kiintea_seinapinta_ala_m2_2');
  });

  test('moveFieldOnPage reorders page fieldIds', () => {
    const form = createDefaultFormDefinition();
    const pageId = form.pages.find((page) => page.title === 'Pinta-alat')!.id;
    const fields = fieldsForPage(form, pageId);
    const first = fields[0];
    const second = fields[1];
    const moved = moveFieldOnPage(form, pageId, first.id, 1);
    const reordered = fieldsForPage(moved, pageId);
    expect(reordered[0].id).toBe(second.id);
    expect(reordered[1].id).toBe(first.id);
  });

  test('removeField removes from all pages', () => {
    const form = createDefaultFormDefinition();
    const pageId = form.pages.find((page) => page.title === 'Pinta-alat')!.id;
    const target = fieldsForPage(form, pageId)[0];
    const next = removeField(form, target.id);
    expect(next.fields.some((field) => field.id === target.id)).toBe(false);
    expect(fieldsForPage(next, pageId).some((field) => field.id === target.id)).toBe(false);
  });

  test('addFieldToPage moves field from other pages', () => {
    const form = createDefaultFormDefinition();
    const sourcePageId = form.pages.find((page) => page.title === 'Pinta-alat')!.id;
    const targetPageId = form.pages.find((page) => page.title.includes('kesto'))!.id;
    const field = fieldsForPage(form, sourcePageId)[0];

    const next = addFieldToPage(form, targetPageId, field.id);
    expect(fieldsForPage(next, sourcePageId).some((item) => item.id === field.id)).toBe(false);
    expect(fieldsForPage(next, targetPageId).some((item) => item.id === field.id)).toBe(true);
  });

  test('fieldsAvailableForPage excludes assigned fields', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const assignedPage = form.pages.find((page) => (page.fieldIds ?? []).length > 0)!;
    const available = fieldsAvailableForPage(form, assignedPage.id);
    const assignedIds = new Set(assignedPage.fieldIds);
    expect(available.every((field) => !assignedIds.has(field.id))).toBe(true);
    expect(available.some((field) => field.key === 'kiintea_seinapinta_ala_m2')).toBe(false);
  });

  test('removeField blocks system fields', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const systemField = form.fields.find((field) => isSystemField(field))!;
    const next = removeField(form, systemField.id);
    expect(next.fields.some((field) => field.id === systemField.id)).toBe(true);
  });

  test('restoreSystemField resets label and formula to defaults', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const systemField = form.fields.find((field) => field.systemKey === 'kokonaishinta')!;
    const edited = { ...systemField, label: 'Muokattu', formula: '1 + 1' };
    const restored = restoreSystemField(edited);
    expect(restored.label).toBe('Kokonaishinta (alv)');
    expect(restored.formula).toContain('urakka_hinta_alv0');
  });

  test('mergeSystemFields preserves custom system formula', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const systemField = form.fields.find((field) => field.systemKey === 'kokonaishinta')!;
    const customized = {
      ...form,
      fields: form.fields.map((field) =>
        field.id === systemField.id
          ? { ...field, formula: 'urakka_hinta_alv0 * 2', label: 'Oma nimi' }
          : field,
      ),
    };
    const normalized = normalizeFormDefinition(customized);
    const restored = normalized.fields.find((field) => field.systemKey === 'kokonaishinta')!;
    expect(restored.label).toBe('Oma nimi');
    expect(restored.formula).toBe('urakka_hinta_alv0 * 2');
  });

  test('normalizeFormDefinition migrates legacy pageId fields', () => {
    const legacy = {
      id: 'default',
      name: 'Legacy',
      version: 1,
      pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0 }],
      fields: [
        {
          id: 'f1',
          pageId: 'p1',
          sortOrder: 0,
          key: 'foo',
          label: 'Foo',
          type: 'number',
          required: true,
          showOnSummary: true,
        },
      ],
    };

    const normalized = normalizeFormDefinition(legacy);
    expect(normalized.fields[0]).not.toHaveProperty('pageId');
    expect(normalized.pages[0].fieldIds).toEqual(['f1']);
  });

  test('normalizeFormDefinition merges system fields', () => {
    const normalized = normalizeFormDefinition(createDefaultFormDefinition());
    expect(normalized.fields.some((field) => field.systemKey === 'kokonaishinta')).toBe(true);
    expect(normalized.fields.some((field) => field.systemKey === 'tyoryhma_kesto_h')).toBe(true);
  });

  test('normalizeFormDefinition migrates legacy select options', () => {
    const legacy = {
      ...createDefaultFormDefinition(),
      fields: createDefaultFormDefinition().fields.map((field) => {
        if (field.key === 'laudoitustyyppi') {
          return {
            ...field,
            debugExampleValue: 'paneeli',
            options: [
              {
                label: 'Paneeli',
                value: 'paneeli',
                multiplier: 1.15,
                exportKey: 'laudoituskerroin',
              },
            ],
          };
        }
        if (field.key === 'laskenta_seinapinta_ala_m2') {
          return {
            ...field,
            formula: '(kiintea_seinapinta_ala_m2 - aukkovahennykset) * laudoituskerroin',
          };
        }
        return field;
      }),
    };

    const form = normalizeFormDefinition(legacy);
    const select = form.fields.find((field) => field.key === 'laudoitustyyppi')!;
    expect(select.options?.[0]).toEqual({ label: 'Paneeli', value: '1.15' });
    expect(select.debugExampleValue).toBe('1.15');
    const computed = form.fields.find((field) => field.key === 'laskenta_seinapinta_ala_m2')!;
    expect(computed.formula).toContain('laudoitustyyppi');
    expect(computed.formula).not.toContain('laudoituskerroin');
  });

  test('normalizeFormDefinition migrates legacy finnish keys', () => {
    const legacy = normalizeFormDefinition({
      ...createDefaultFormDefinition(),
      fields: createDefaultFormDefinition().fields.map((field) =>
        field.key === 'kiintea_seinapinta_ala_m2'
          ? { ...field, key: 'kiinteä_seinäpinta_ala_m2' }
          : field,
      ),
    });
    expect(legacy.fields.some((field) => field.key === 'kiintea_seinapinta_ala_m2')).toBe(true);
  });

  test('duplicateField creates copy with new id and key', () => {
    const form = createDefaultFormDefinition();
    const source = form.fields[0];
    const next = duplicateField(form, source.id);
    expect(next.fields).toHaveLength(form.fields.length + 1);
    const copy = next.fields.at(-1)!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.key).not.toBe(source.key);
    expect(copy.label).toContain('kopio');
  });

  test('duplicateField skips system fields', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const systemField = form.fields.find((field) => field.systemKey)!;
    const next = duplicateField(form, systemField.id);
    expect(next.fields).toHaveLength(form.fields.length);
  });

  test('unknownFormulaIdentifiers flags missing keys', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const unknown = unknownFormulaIdentifiers(form, 'kiintea_seinapinta_ala_m2 + puuttuva_avain');
    expect(unknown).toContain('puuttuva_avain');
    expect(unknown).not.toContain('kiintea_seinapinta_ala_m2');
  });

  test('unknownFormulaIdentifiers allows settings prefix', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const unknown = unknownFormulaIdentifiers(form, 'tyoryhma_kesto_pv * settings.workday_hours');
    expect(unknown).toHaveLength(0);
  });

  test('unknownFormulaIdentifiers allows asetukset prefix', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const unknown = unknownFormulaIdentifiers(form, 'tyoryhma_kesto_pv * asetukset.tyopaivan_pituus');
    expect(unknown).toHaveLength(0);
  });

  test('unknownFormulaIdentifiers allows product list attributes', () => {
    const form = addField(normalizeFormDefinition(createDefaultFormDefinition()), 'product_select');
    const created = form.fields.at(-1)!;
    created.key = 'kaytettava_maali';
    const unknown = unknownFormulaIdentifiers(
      form,
      'laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki',
    );
    expect(unknown).toHaveLength(0);
  });

  test('product_select is an editable field type', () => {
    expect(EDITABLE_FIELD_TYPES).toContain('product_select');
    const form = createDefaultFormDefinition();
    const next = addField(form, 'product_select');
    expect(next.fields.at(-1)?.type).toBe('product_select');
  });

  test('default form has no hardcoded materials page', () => {
    const form = createDefaultFormDefinition();
    expect(form.pages.some((page) => page.system === 'materials')).toBe(false);
    expect(form.pages.some((page) => page.id === 'page_materials')).toBe(false);
  });

  test('normalizeFormDefinition converts legacy materials pages to regular pages', () => {
    const legacy = {
      ...createDefaultFormDefinition(),
      pages: [
        ...createDefaultFormDefinition().pages,
        {
          id: 'page_materials',
          title: 'Materiaalit',
          sortOrder: 3,
          system: 'materials' as const,
          fieldIds: [] as string[],
        },
      ],
    };
    const normalized = normalizeFormDefinition(legacy);
    const materials = normalized.pages.find((page) => page.id === 'page_materials');
    expect(materials).toBeDefined();
    expect(materials?.system).toBeUndefined();
    expect(isSystemPage(materials!)).toBe(false);
    const removed = removePage(normalized, materials!.id);
    expect(removed.pages.some((page) => page.id === 'page_materials')).toBe(false);
  });

  test('normalizeFormDefinition migrates legacy formula keys to Finnish', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    form.fields = form.fields.map((field) =>
      field.systemKey === 'tyoryhma_kesto_h'
        ? { ...field, formula: 'tyoryhma_kesto_pv * settings.workday_hours' }
        : field,
    );
    const normalized = normalizeFormDefinition(form);
    const tyoryhma = normalized.fields.find((field) => field.systemKey === 'tyoryhma_kesto_h');
    expect(tyoryhma?.formula).toContain('asetukset.tyopaivan_pituus');
  });

  test('tyoryhma_kesto_pv is a system field', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const duration = form.fields.find((field) => field.systemKey === 'tyoryhma_kesto_pv');
    expect(duration).toBeDefined();
    expect(duration?.type).toBe('computed');
    expect(duration?.allowManualOverride).toBe(true);
    expect(form.fields.filter((field) => field.key === 'tyoryhma_kesto_pv')).toHaveLength(1);
    const page = form.pages.find((item) => item.title.includes('kesto'));
    expect(page?.fieldIds).toContain(duration?.id);
  });

  test('normalizeFormDefinition promotes legacy duration user field', () => {
    const legacy = {
      ...createDefaultFormDefinition(),
      pages: createDefaultFormDefinition().pages.map((page) =>
        page.title.includes('kesto') ? { ...page, fieldIds: ['field_duration'] } : page,
      ),
      fields: [
        ...createDefaultFormDefinition().fields,
        {
          id: 'field_duration',
          key: 'tyoryhma_kesto_pv',
          label: 'Työryhmän kesto',
          type: 'number' as const,
          required: true,
          showOnSummary: true,
          unit: 'pv',
          debugExampleValue: '5',
        },
      ],
    };
    const normalized = normalizeFormDefinition(legacy);
    expect(normalized.fields.filter((field) => field.key === 'tyoryhma_kesto_pv')).toHaveLength(1);
    const duration = normalized.fields.find((field) => field.systemKey === 'tyoryhma_kesto_pv');
    expect(duration?.debugExampleValue).toBe('5');
    const page = normalized.pages.find((item) => item.title.includes('kesto'));
    expect(page?.fieldIds).toContain(duration?.id);
    expect(page?.fieldIds).not.toContain('field_duration');
  });
});
