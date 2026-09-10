import {
  previewFormContext,
  runFormCalculation,
} from '../src/core/calculation/calculationPipeline';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition, unknownFormulaIdentifiers } from '../src/core/form/formDefinitionHelpers';
import { buildDebugFieldValues } from '../src/core/form/pipeline';
import type { Product } from '../src/core/models/types';
import { defaultSettings } from '../src/core/models/types';
import { validateFormPageWithValues } from '../src/core/wizard/wizardPageHelpers';

const paint: Product = {
  id: '15a3a629-b764-4e10-bf5e-3ce5e298c1e2',
  name: 'Ulkomaali',
  unit: 'l',
  unitPriceVat0: 8,
  attributes: { consumption: 8, work_factor: 1 },
  createdAt: new Date('2026-01-01'),
};

const dino: Product = {
  id: 'lift-dino-180',
  name: 'Henkilönostin Dino180',
  unit: 'pv',
  unitPriceVat0: 120,
  createdAt: new Date('2026-01-01'),
};

function defaultForm() {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

function baseValues(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...buildDebugFieldValues(defaultForm()),
    henkilonostin_valinta: 'false',
    ...extra,
  };
}

describe('julkisivumaalaus henkilönostin', () => {
  test('version 107 places lift fields after Maalit (ALV 0)', () => {
    const form = defaultForm();
    expect(form.version).toBe(107);
    expect(form.id).toBe('julkisivumaalaus');

    const materials = form.pages.find((page) => page.id === 'page_materials');
    const ids = materials?.fieldIds ?? [];
    const alv0 = ids.indexOf('field_maalit_alv0');
    expect(ids.slice(alv0, alv0 + 5)).toEqual([
      'field_maalit_alv0',
      'field_henkilonostin_valinta',
      'field_henkilonostin',
      'field_henkilonostin_vuokrapaivat',
      'field_henkilonostin_kustannus_alv0',
    ]);

    const valinta = form.fields.find((field) => field.key === 'henkilonostin_valinta');
    expect(valinta?.type).toBe('boolean');
    expect(valinta?.defaultValue).toBe('false');

    const product = form.fields.find((field) => field.key === 'henkilonostin');
    expect(product?.type).toBe('product_select');
    expect(product?.defaultValue).toBe('Henkilönostin Dino180');
    expect(product?.showWhen).toEqual({
      fieldKey: 'henkilonostin_valinta',
      operator: 'eq',
      value: 'true',
    });

    for (const field of form.fields) {
      if (!field.formula) continue;
      expect(unknownFormulaIdentifiers(form, field.formula)).toEqual([]);
    }
  });

  test('default Ei hides product and days on the materials page', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_materials')!;
    expect(validateFormPageWithValues(form, page, baseValues(), '', [paint, dino])).toBeNull();
  });

  test('Kyllä without days is invalid; name default selects Dino180', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_materials')!;
    const withoutDays = baseValues({ henkilonostin_valinta: 'true' });
    delete withoutDays.henkilonostin_vuokrapaivat;

    expect(validateFormPageWithValues(form, page, withoutDays, '', [paint, dino])).toContain(
      'Vuokra-aika',
    );

    expect(
      validateFormPageWithValues(
        form,
        page,
        baseValues({ henkilonostin_valinta: 'true', henkilonostin_vuokrapaivat: '2' }),
        '',
        [paint, dino],
      ),
    ).toBeNull();
  });

  test('adds days × daily price + 150 € to materials and 1 h work per day', () => {
    const form = defaultForm();
    const off = runFormCalculation({
      form,
      fieldValues: baseValues(),
      materialLines: [],
      products: [paint, dino],
      settings: defaultSettings,
    });

    const on = runFormCalculation({
      form,
      fieldValues: baseValues({
        henkilonostin_valinta: 'true',
        henkilonostin: 'Henkilönostin Dino180',
        henkilonostin_vuokrapaivat: '2',
      }),
      materialLines: [],
      products: [paint, dino],
      settings: defaultSettings,
    });

    expect(on.context.henkilonostin_kustannus_alv0).toBeCloseTo(2 * 120 + 150, 5);
    expect(on.result.materialsVat0 - off.result.materialsVat0).toBeCloseTo(390, 5);
    expect(on.context.henkilotyotunnit - off.context.henkilotyotunnit).toBeCloseTo(2, 5);
  });

  test('live preview uses product name default without storing an id', () => {
    const form = defaultForm();
    const preview = previewFormContext(
      form,
      baseValues({
        henkilonostin_valinta: 'true',
        henkilonostin_vuokrapaivat: '3',
      }),
      [],
      [paint, dino],
      defaultSettings,
    );

    expect(preview.henkilonostin_kustannus_alv0).toBeCloseTo(3 * 120 + 150, 5);
    expect(preview.henkilotyotunnit).toBeGreaterThan(3);
  });
});
