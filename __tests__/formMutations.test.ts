import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import {
  addField,
  addFieldToPage,
  addPage,
  fieldsForPage,
  moveFieldOnPage,
  movePage,
  removeField,
  removePage,
  slugifyKey,
  uniqueFieldKey,
} from '../src/core/form/formMutations';

describe('formMutations', () => {
  test('slugifyKey converts finnish labels', () => {
    expect(slugifyKey('Laudoitustyyppi')).toBe('laudoitustyyppi');
    expect(slugifyKey('Kiinteä seinäpinta')).toBe('kiintea_seinapinta');
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
    expect(created?.options?.[0].exportKey).toContain('_kerroin');
  });

  test('uniqueFieldKey avoids collisions', () => {
    const form = createDefaultFormDefinition();
    expect(uniqueFieldKey(form, 'kiinteä_seinäpinta_ala_m2')).toBe('kiinteä_seinäpinta_ala_m2_2');
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
});
