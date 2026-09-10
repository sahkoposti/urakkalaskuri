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

describe('julkisivumaalaus veranta ja lisäseinät', () => {
  test('version 110 places veranta before lisäseinät', () => {
    const form = defaultForm();
    expect(form.version).toBe(111);

    const surfaces = form.pages.find((page) => page.id === 'page_surfaces');
    const ids = surfaces?.fieldIds ?? [];
    const harja = ids.indexOf('field_harjakorkeus');
    expect(ids.slice(harja, harja + 7)).toEqual([
      'field_harjakorkeus',
      'field_veranta_valinta',
      'field_veranta_pituus',
      'field_veranta_korkeus',
      'field_lisaseinien_lkm',
      'field_lisaseinien_pituus',
      'field_lisaseinien_keskikorkeus',
    ]);

    const valinta = form.fields.find((field) => field.key === 'veranta_valinta');
    expect(valinta?.type).toBe('boolean');
    expect(valinta?.defaultValue).toBe('false');
    expect(valinta?.helpText).toBe('Taloa matalampi uloke.');

    const lisat = form.fields.find((field) => field.key === 'lisaseinien_lkm');
    expect(lisat?.helpText).toBe('Talon korkuisia seiniä.');

    const piiri = form.fields.find((field) => field.key === 'piiri_jm');
    expect(piiri?.formula).toContain('veranta_pituus_m');
    expect(piiri?.formula).toContain('lisaseinien_pituus_m * 2 / 3');

    const seinat = form.fields.find((field) => field.key === 'seinien_lkm');
    expect(seinat?.formula).toBe('max(4 + lisaseinien_lkm, 1)');
    expect(seinat?.formula).not.toContain('veranta');

    const nurkat = form.fields.find((field) => field.key === 'nurkkalaudat_jm');
    expect(nurkat?.formula).toBe(
      'seinien_lkm * raystaskorkeus_m + if(veranta_valinta == 1, 2 * veranta_korkeus_m, 0)',
    );

    const tyo = form.fields.find((field) => field.key === 'veranta_tyo_h');
    expect(tyo?.formula).toBe('if(veranta_valinta == 1, 2, 0)');

    const henkilotyot = form.fields.find((field) => field.key === 'henkilotyotunnit');
    expect(henkilotyot?.formula).toContain('veranta_tyo_h');

    const soffit = form.fields.find((field) => field.key === 'raystaanaluset_jm');
    expect(soffit?.formula).toContain('cos(20)');
    expect(soffit?.formula).toContain('veranta_pituus_m + 0.7');
    expect(soffit?.formula).toContain('lisaseinien_pituus_m * 2 / 3 + lisaseinien_lkm * 0.7');

    for (const field of form.fields) {
      if (!field.formula) continue;
      expect(unknownFormulaIdentifiers(form, field.formula)).toEqual([]);
    }
  });

  test('default Ei hides veranda length and height', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_surfaces')!;
    expect(validateFormPageWithValues(form, page, baseValues(), '', [paint])).toBeNull();
  });

  test('Kyllä without length or height is invalid', () => {
    const form = defaultForm();
    const page = form.pages.find((item) => item.id === 'page_surfaces')!;
    const without = baseValues({ veranta_valinta: 'true' });
    delete without.veranta_pituus_m;
    delete without.veranta_korkeus_m;

    const error = validateFormPageWithValues(form, page, without, '', [paint]);
    expect(error).toBeTruthy();
  });

  test('veranta adds 2/3 wall area, full eaves length, two corner boards, not wall count', () => {
    const off = run(baseValues());
    const on = run(
      baseValues({
        veranta_valinta: 'true',
        veranta_pituus_m: '6',
        veranta_korkeus_m: '3',
      }),
    );

    expect(on.context.laskenta_seinapinta_ala_m2 - off.context.laskenta_seinapinta_ala_m2).toBeCloseTo(
      6 * 3 * (2 / 3),
      5,
    );
    expect(on.context.piiri_jm - off.context.piiri_jm).toBeCloseTo(6, 5);
    expect(on.context.seinien_lkm).toBe(off.context.seinien_lkm);
    expect(on.context.seinien_lkm).toBe(4);
    expect(on.context.nurkkalaudat_jm - off.context.nurkkalaudat_jm).toBeCloseTo(2 * 3, 5);
    expect(on.context.veranta_tyo_h).toBe(2);
    expect(off.context.veranta_tyo_h).toBe(0);
    expect(on.context.henkilotyotunnit - off.context.henkilotyotunnit).toBeGreaterThan(2);
    expect(on.context.henkilotyotunnit - off.context.henkilotyotunnit).toBeCloseTo(
      2 + (on.context.paatuote_tyo_h - off.context.paatuote_tyo_h),
      5,
    );
  });

  test('lisäseinät add 2/3 wall area and eaves, and increase wall count', () => {
    const off = run(baseValues());
    const on = run(
      baseValues({
        lisaseinien_lkm: '2',
        lisaseinien_pituus_m: '9',
        lisaseinien_keskikorkeus_m: '2.4',
      }),
    );

    expect(on.context.laskenta_seinapinta_ala_m2 - off.context.laskenta_seinapinta_ala_m2).toBeCloseTo(
      9 * 2.4 * (2 / 3),
      5,
    );
    expect(on.context.piiri_jm - off.context.piiri_jm).toBeCloseTo(9 * (2 / 3), 5);
    expect(on.context.seinien_lkm).toBe(6);
    expect(on.context.nurkkalaudat_jm - off.context.nurkkalaudat_jm).toBeCloseTo(
      2 * off.context.raystaskorkeus_m,
      5,
    );
  });

  test('live preview applies veranta and extra walls together', () => {
    const preview = previewFormContext(
      defaultForm(),
      baseValues({
        veranta_valinta: 'true',
        veranta_pituus_m: '4',
        veranta_korkeus_m: '2.5',
        lisaseinien_lkm: '1',
        lisaseinien_pituus_m: '3',
        lisaseinien_keskikorkeus_m: '3',
      }),
      [],
      [paint],
      defaultSettings,
    );
    const off = previewFormContext(defaultForm(), baseValues(), [], [paint], defaultSettings);

    expect(preview.laskenta_seinapinta_ala_m2 - off.laskenta_seinapinta_ala_m2).toBeCloseTo(
      4 * 2.5 * (2 / 3) + 3 * 3 * (2 / 3),
      5,
    );
    expect(preview.piiri_jm - off.piiri_jm).toBeCloseTo(4 + 3 * (2 / 3), 5);
    expect(preview.seinien_lkm).toBe(5);
    expect(preview.nurkkalaudat_jm - off.nurkkalaudat_jm).toBeCloseTo(2 * 2.5 + 1 * off.raystaskorkeus_m, 5);
  });

  test('soffits add 0.7 m per wall and stretch gables by 1/cos(20°)', () => {
    const off = run(
      baseValues({
        raystaanaluset_valinta: 'true',
        veranta_valinta: 'false',
        lisaseinien_lkm: '0',
      }),
    );
    const eaves = Number(off.context.raystassivun_pituus_m);
    const gable = Number(off.context.paadyn_leveys_m);
    expect(off.context.raystaanaluset_jm).toBeCloseTo(
      2 * (eaves + 0.7) + (2 * (gable + 0.7)) / Math.cos((20 * Math.PI) / 180),
      5,
    );
    expect(off.context.piiri_jm).toBeCloseTo(2 * eaves + 2 * gable, 5);
  });

  test('veranta soffits are full length plus 0.7 m, not 2/3', () => {
    const off = run(baseValues({ raystaanaluset_valinta: 'true' }));
    const on = run(
      baseValues({
        raystaanaluset_valinta: 'true',
        veranta_valinta: 'true',
        veranta_pituus_m: '6',
        veranta_korkeus_m: '3',
      }),
    );

    expect(on.context.raystaanaluset_jm - off.context.raystaanaluset_jm).toBeCloseTo(6 + 0.7, 5);
    expect(on.context.piiri_jm - off.context.piiri_jm).toBeCloseTo(6, 5);
  });

  test('lisäseinät soffits use 2/3 length plus 0.7 m per extra wall', () => {
    const off = run(baseValues({ raystaanaluset_valinta: 'true' }));
    const on = run(
      baseValues({
        raystaanaluset_valinta: 'true',
        lisaseinien_lkm: '2',
        lisaseinien_pituus_m: '9',
        lisaseinien_keskikorkeus_m: '2.4',
      }),
    );

    expect(on.context.raystaanaluset_jm - off.context.raystaanaluset_jm).toBeCloseTo(
      9 * (2 / 3) + 2 * 0.7,
      5,
    );
    expect(on.context.piiri_jm - off.context.piiri_jm).toBeCloseTo(9 * (2 / 3), 5);
  });
});
