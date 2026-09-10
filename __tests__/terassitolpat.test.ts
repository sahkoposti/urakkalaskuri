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

function defaultForm() {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

function baseValues(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...buildDebugFieldValues(defaultForm()),
    henkilonostin_valinta: 'false',
    kattolyhdyt_valinta: 'false',
    veranta_valinta: 'false',
    lisaseinien_lkm: '0',
    terassitolpat_valinta: 'false',
    alakatot_valinta: 'false',
    alakatot_kattotuolit_valinta: 'false',
    ...extra,
  };
}

function run(values: Record<string, string>) {
  return runFormCalculation({
    form: defaultForm(),
    fieldValues: values,
    materialLines: [],
    products: [paint],
    settings: defaultSettings,
  });
}

describe('julkisivumaalaus terassitolpat ja kattotuolit', () => {
  test('version 111 places posts after kattolyhdyt and kattotuolit after alakatot', () => {
    const form = defaultForm();
    expect(form.version).toBe(112);

    const surfaces = form.pages.find((page) => page.id === 'page_surfaces');
    const ids = surfaces?.fieldIds ?? [];
    expect(ids.slice(ids.indexOf('field_alakatot_m2'), ids.indexOf('field_alakatot_m2') + 7)).toEqual([
      'field_alakatot_m2',
      'field_alakatot_kattotuolit_valinta',
      'field_kattolyhdyt_valinta',
      'field_kattolyhdyt_lkm',
      'field_kattolyhdyt_m2',
      'field_terassitolpat_valinta',
      'field_terassitolpat_lkm',
    ]);
    expect(ids).toContain('field_terassitolpat_kunto');

    const duration = form.pages.find((page) => page.id === 'page_duration');
    expect(duration?.fieldIds).toContain('field_terassitolpat_tyo_h');

    const valinta = form.fields.find((field) => field.key === 'terassitolpat_valinta');
    expect(valinta?.type).toBe('boolean');
    expect(valinta?.defaultValue).toBe('false');

    const kunto = form.fields.find((field) => field.key === 'terassitolpat_kunto');
    expect(kunto?.type).toBe('select');
    expect(kunto?.defaultValue).toBe('0');

    const kattotuolit = form.fields.find((field) => field.key === 'alakatot_kattotuolit_valinta');
    expect(kattotuolit?.type).toBe('boolean');
    expect(kattotuolit?.defaultValue).toBe('false');
    expect(kattotuolit?.showWhen).toEqual({
      fieldKey: 'alakatot_valinta',
      operator: 'eq',
      value: 'true',
    });

    const alakatotTyo = form.fields.find((field) => field.key === 'alakatot_tyo_h');
    expect(alakatotTyo?.formula).toContain('if(alakatot_kattotuolit_valinta == 1, 2, 1)');

    const henkilotyot = form.fields.find((field) => field.key === 'henkilotyotunnit');
    expect(henkilotyot?.formula).toContain('terassitolpat_tyo_h');

    for (const field of form.fields) {
      if (!field.formula) continue;
      expect(unknownFormulaIdentifiers(form, field.formula)).toEqual([]);
    }
  });

  test('default Ei hides post count and condition', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_surfaces')!;
    expect(validateFormPageWithValues(form, page, baseValues(), '', [paint])).toBeNull();
  });

  test('Kyllä without count is invalid', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_surfaces')!;
    const without = baseValues({ terassitolpat_valinta: 'true' });
    delete without.terassitolpat_lkm;

    expect(validateFormPageWithValues(form, page, without, '', [paint])).toBeTruthy();
  });

  test('no scraping is 20 min per post and scraping is 1 h per post', () => {
    const off = run(baseValues());
    const clean = run(
      baseValues({
        terassitolpat_valinta: 'true',
        terassitolpat_lkm: '6',
        terassitolpat_kunto: '0',
      }),
    );
    const scraped = run(
      baseValues({
        terassitolpat_valinta: 'true',
        terassitolpat_lkm: '6',
        terassitolpat_kunto: '1',
      }),
    );

    expect(clean.context.terassitolpat_tyo_h).toBeCloseTo(6 * (20 / 60), 5);
    expect(scraped.context.terassitolpat_tyo_h).toBeCloseTo(6, 5);
    expect(clean.context.henkilotyotunnit - off.context.henkilotyotunnit).toBeCloseTo(2, 5);
    expect(scraped.context.henkilotyotunnit - off.context.henkilotyotunnit).toBeCloseTo(6, 5);
  });

  test('kattotuolit doubles alakatot work', () => {
    const without = run(
      baseValues({
        alakatot_valinta: 'true',
        alakatot_m2: '12',
        alakatot_kattotuolit_valinta: 'false',
      }),
    );
    const withTrusses = run(
      baseValues({
        alakatot_valinta: 'true',
        alakatot_m2: '12',
        alakatot_kattotuolit_valinta: 'true',
      }),
    );

    expect(without.context.alakatot_tyo_h).toBeGreaterThan(0);
    expect(withTrusses.context.alakatot_tyo_h).toBeCloseTo(without.context.alakatot_tyo_h * 2, 5);
    expect(withTrusses.context.henkilotyotunnit - without.context.henkilotyotunnit).toBeCloseTo(
      without.context.alakatot_tyo_h,
      5,
    );
  });

  test('live preview hides kattotuolit work when alakatot is off', () => {
    const preview = previewFormContext(
      defaultForm(),
      baseValues({
        alakatot_valinta: 'false',
        alakatot_kattotuolit_valinta: 'true',
        alakatot_m2: '12',
      }),
      [],
      [paint],
      defaultSettings,
    );

    expect(preview.alakatot_tyo_h).toBe(0);
  });
});
