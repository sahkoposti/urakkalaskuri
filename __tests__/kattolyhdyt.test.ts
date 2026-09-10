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
    ...extra,
  };
}

describe('julkisivumaalaus kattolyhdyt', () => {
  test('places kattolyhdyt after alakatot', () => {
    const form = defaultForm();
    expect(form.version).toBe(111);

    const surfaces = form.pages.find((page) => page.id === 'page_surfaces');
    const ids = surfaces?.fieldIds ?? [];
    const alakatot = ids.indexOf('field_alakatot_m2');
    expect(ids.slice(alakatot, alakatot + 5)).toEqual([
      'field_alakatot_m2',
      'field_alakatot_kattotuolit_valinta',
      'field_kattolyhdyt_valinta',
      'field_kattolyhdyt_lkm',
      'field_kattolyhdyt_m2',
    ]);

    const duration = form.pages.find((page) => page.id === 'page_duration');
    expect(duration?.fieldIds).toContain('field_kattolyhdyt_tyo_h');

    const valinta = form.fields.find((field) => field.key === 'kattolyhdyt_valinta');
    expect(valinta?.type).toBe('boolean');
    expect(valinta?.defaultValue).toBe('false');

    const tyo = form.fields.find((field) => field.key === 'kattolyhdyt_tyo_h');
    expect(tyo?.formula).toBe(
      'if(kattolyhdyt_valinta == 1, kattolyhdyt_lkm * 2 + kattolyhdyt_m2 / 5, 0)',
    );

    const henkilotyot = form.fields.find((field) => field.key === 'henkilotyotunnit');
    expect(henkilotyot?.formula).toContain('kattolyhdyt_tyo_h');

    for (const field of form.fields) {
      if (!field.formula) continue;
      expect(unknownFormulaIdentifiers(form, field.formula)).toEqual([]);
    }
  });

  test('default Ei hides quantity and area on the surfaces page', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_surfaces')!;
    expect(validateFormPageWithValues(form, page, baseValues(), '', [paint])).toBeNull();
  });

  test('Kyllä without quantity or area is invalid', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_surfaces')!;
    const without = baseValues({ kattolyhdyt_valinta: 'true' });
    delete without.kattolyhdyt_lkm;
    delete without.kattolyhdyt_m2;

    const error = validateFormPageWithValues(form, page, without, '', [paint]);
    expect(error).toBeTruthy();
  });

  test('adds 2 h per piece plus 5 m²/h and area to laskenta_seinapinta', () => {
    const form = defaultForm();
    const off = runFormCalculation({
      form,
      fieldValues: baseValues(),
      materialLines: [],
      products: [paint],
      settings: defaultSettings,
    });
    const on = runFormCalculation({
      form,
      fieldValues: baseValues({
        kattolyhdyt_valinta: 'true',
        kattolyhdyt_lkm: '2',
        kattolyhdyt_m2: '10',
      }),
      materialLines: [],
      products: [paint],
      settings: defaultSettings,
    });

    expect(on.context.kattolyhdyt_tyo_h).toBeCloseTo(2 * 2 + 10 / 5, 5);
    expect(on.context.henkilotyotunnit - off.context.henkilotyotunnit).toBeGreaterThanOrEqual(6);
    expect(on.context.henkilotyotunnit - off.context.henkilotyotunnit).toBeCloseTo(
      6 + (on.context.paatuote_tyo_h - off.context.paatuote_tyo_h),
      5,
    );
    expect(on.context.laskenta_seinapinta_ala_m2 - off.context.laskenta_seinapinta_ala_m2).toBeCloseTo(
      10,
      5,
    );
    expect(on.context.maalit_yhteensa_litraa).toBeGreaterThan(off.context.maalit_yhteensa_litraa);
    expect(on.context.seinamaalauksen_laskentapinta_ala_m2).toBeCloseTo(
      off.context.seinamaalauksen_laskentapinta_ala_m2,
      5,
    );
  });

  test('live preview keeps kattolyhdyt hours when julkisivu is off', () => {
    const form = defaultForm();
    const values = baseValues({
      julkisivupinnat_valinta: 'false',
      kattolyhdyt_valinta: 'true',
      kattolyhdyt_lkm: '1',
      kattolyhdyt_m2: '5',
    });
    const preview = previewFormContext(form, values, [], [paint], defaultSettings);

    expect(preview.laskenta_seinapinta_ala_m2).toBeCloseTo(5, 5);
    expect(preview.kattolyhdyt_tyo_h).toBeCloseTo(2 + 1, 5);
  });
});
