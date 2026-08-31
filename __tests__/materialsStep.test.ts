import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import type { Product } from '../src/core/models/types';
import { validateFormPageWithValues } from '../src/core/wizard/wizardPageHelpers';

describe('materials system page', () => {
  test('default form includes materials page', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    expect(form.pages.some((page) => page.system === 'materials')).toBe(true);
  });

  test('normalize adds materials page when missing', () => {
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

    const materialsPage = form.pages.find((page) => page.system === 'materials');
    expect(materialsPage).toBeDefined();
    expect(materialsPage?.title).toBe('Materiaalit');

    const durationIndex = form.pages.findIndex((page) => page.id === 'page_duration');
    expect(form.pages.findIndex((page) => page.system === 'materials')).toBe(durationIndex - 1);
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

  test('accepts empty materials page', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const page = form.pages.find((item) => item.system === 'materials')!;
    expect(validateFormPageWithValues(form, page, {}, '', products, {}, [])).toBeNull();
  });

  test('rejects zero quantity line', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
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
