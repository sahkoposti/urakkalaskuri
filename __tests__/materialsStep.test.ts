import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import type { Product } from '../src/core/models/types';
import { validateFormPageWithValues } from '../src/core/wizard/wizardPageHelpers';

describe('materials system page', () => {
  test('default form does not include a hardcoded materials line page', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    expect(form.pages.some((page) => page.system === 'materials')).toBe(false);
  });

  test('normalize does not add materials page when missing', () => {
    const form = normalizeFormDefinition({
      id: 'test',
      name: 'Testi',
      version: 1,
      pages: [
        {
          id: 'page_customer',
          title: 'Asiakas',
          sortOrder: 0,
          system: 'customer',
          fieldIds: [],
        },
        {
          id: 'page_duration',
          title: 'Kesto',
          sortOrder: 1,
          fieldIds: ['field_system_tyoryhma_kesto_pv'],
        },
      ],
      fields: [],
      updatedAt: 1,
    });

    expect(form.pages.some((page) => page.system === 'materials')).toBe(false);
  });

  test('normalize preserves explicit materials page', () => {
    const imported = normalizeFormDefinition({
      id: 'test',
      name: 'Testi',
      version: 1,
      pages: [
        {
          id: 'page_customer',
          title: 'Asiakas',
          sortOrder: 0,
          system: 'customer',
          fieldIds: [],
        },
        {
          id: 'page_materials_custom',
          title: 'Omat materiaalit',
          sortOrder: 1,
          system: 'materials',
          fieldIds: [],
        },
      ],
      fields: [],
      updatedAt: 1,
    });

    expect(imported.pages.filter((page) => page.system === 'materials')).toHaveLength(1);
    expect(imported.pages.find((page) => page.system === 'materials')?.title).toBe('Omat materiaalit');
  });

  test('normalize uniqueifies duplicate page ids', () => {
    const form = normalizeFormDefinition({
      id: 'test',
      name: 'Testi',
      version: 1,
      pages: [
        {
          id: 'page_materials',
          title: 'Maalit ja menekit',
          sortOrder: 0,
          fieldIds: [],
        },
        {
          id: 'page_materials',
          title: 'Materiaalit',
          sortOrder: 1,
          system: 'materials',
          fieldIds: [],
        },
      ],
      fields: [],
      updatedAt: 1,
    });

    const ids = form.pages.map((page) => page.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(form.pages[0]?.id).toBe('page_materials');
    expect(form.pages[1]?.id).toBe('page_materials_2');
  });
});

describe('validateFormPageWithValues materials', () => {
  const products: Product[] = [
    {
      id: 'prod_1',
      name: 'Laatta',
      unit: 'm²',
      unitPriceVat0: 10,
      createdAt: new Date(),
    },
  ];

  const materialsForm = () =>
    normalizeFormDefinition({
      id: 'test',
      name: 'Testi',
      version: 1,
      pages: [
        {
          id: 'page_materials',
          title: 'Materiaalit',
          sortOrder: 0,
          system: 'materials',
          fieldIds: [],
        },
      ],
      fields: [],
      updatedAt: 1,
    });

  test('accepts empty materials page', () => {
    const form = materialsForm();
    const page = form.pages.find((item) => item.system === 'materials')!;
    expect(validateFormPageWithValues(form, page, {}, '', products, {}, [])).toBeNull();
  });

  test('rejects zero quantity line', () => {
    const form = materialsForm();
    const page = form.pages.find((item) => item.system === 'materials')!;
    expect(
      validateFormPageWithValues(
        form,
        page,
        {},
        '',
        products,
        {},
        [{ product: products[0], quantity: 0 }],
      ),
    ).toContain('Materiaalirivi 1');
  });
});
