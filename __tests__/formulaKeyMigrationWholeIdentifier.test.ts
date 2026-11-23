import { readFileSync } from 'fs';
import { join } from 'path';
import { runFormCalculation } from '../src/core/calculation/calculationPipeline';
import { normalizeFormDefinition, unknownFormulaIdentifiers } from '../src/core/form/formDefinitionHelpers';
import { parseImportedFormDefinition } from '../src/core/form/formDefinitionIo';
import { LEGACY_KEY_MAP, migrateFormulaKeys } from '../src/core/form/systemFields';
import type { FormDefinition } from '../src/core/form/types';
import { defaultSettings, type Product } from '../src/core/models/types';

const ROOT = join(__dirname, '..');
const TEMPLATES = {
  v116: 'docs/examples/urakkalaskuri_peruslaskenta_v116.json',
  v121: 'urakkalaskuri_peruslaskenta_v121.json',
  v123: 'urakkalaskuri_peruslaskenta_v123.json',
};
const STRUCTURES = ['ikkunanpokat', 'ovet', 'sokkeli', 'kaiteet', 'alakatot', 'tiilikaton'];

const readTemplate = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** The old (pre-1.3.6) migration: plain substring replaceAll. */
function oldSubstringMigration(formula: string): string {
  let result = formula;
  const entries = Object.entries(LEGACY_KEY_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [legacy, next] of entries) result = result.replaceAll(legacy, next);
  return result;
}

/** A form as it is saved on phones running <= 1.3.5. */
function brokenSavedForm(correct: FormDefinition): FormDefinition {
  return {
    ...correct,
    fields: correct.fields.map((field) =>
      field.formula ? { ...field, formula: oldSubstringMigration(field.formula) } : field,
    ),
  };
}

const formulaOf = (form: FormDefinition, key: string) =>
  form.fields.find((field) => field.key === key)?.formula ?? '';

describe('migrateFormulaKeys replaces whole identifiers only', () => {
  test('legacy keys are migrated, longer identifiers are left intact', () => {
    expect(migrateFormulaKeys('materiaalit_alv0 * 2')).toBe('materiaalit * 2');
    expect(migrateFormulaKeys('x + ikkunanpokat_materiaalit_alv0')).toBe('x + ikkunanpokat_materiaalit_alv0');
    expect(migrateFormulaKeys('materiaalit_alv0_x + a_myyntikate_eur')).toBe('materiaalit_alv0_x + a_myyntikate_eur');
    expect(migrateFormulaKeys('settings.vat_percent / 100')).toBe('asetukset.alv_prosentti / 100');
    expect(migrateFormulaKeys('kiinteä_seinäpinta_ala_m2+1')).toBe('kiintea_seinapinta_ala_m2+1');
    expect(migrateFormulaKeys('round(1.24 * myyntikate_eur, 2)')).toBe('round(1.24 * myyntikate, 2)');
  });

  for (const [version, path] of Object.entries(TEMPLATES)) {
    test(`peruslaskenta ${version}: structure formulas keep their full identifiers`, () => {
      const form = parseImportedFormDefinition(readTemplate(path));
      const keys = new Set(form.fields.map((field) => field.key));
      let checked = 0;
      for (const structure of STRUCTURES) {
        const materialKey = `${structure}_materiaalit_alv0`;
        if (!keys.has(materialKey)) continue;
        const priceFormulas = form.fields.filter(
          (field) => field.formula && field.formula.includes(`${structure}_materiaalit`),
        );
        expect(priceFormulas.length).toBeGreaterThan(0);
        for (const field of priceFormulas) {
          expect(field.formula).toMatch(new RegExp(`${materialKey}(?![A-Za-z0-9_])`));
          checked += 1;
        }
      }
      expect(checked).toBeGreaterThanOrEqual(STRUCTURES.length - 1);
      for (const field of form.fields) {
        if (!field.formula) continue;
        expect(unknownFormulaIdentifiers(form, field.formula).filter((ident) => ident.endsWith('_materiaalit'))).toEqual([]);
      }
    });
  }
});

const formulasById = (form: FormDefinition) =>
  Object.fromEntries(form.fields.map((field) => [field.id, field.formula ?? null]));

describe('repair of saved forms broken by the old migration', () => {
  for (const [version, path] of Object.entries(TEMPLATES)) {
    test(`peruslaskenta ${version}: broken saved form is repaired on load, idempotently`, () => {
      const correct = parseImportedFormDefinition(readTemplate(path));
      const broken = brokenSavedForm(correct);
      const brokenCount = broken.fields.filter(
        (field, i) => field.formula !== correct.fields[i].formula,
      ).length;
      expect(brokenCount).toBeGreaterThan(0);

      const repaired = normalizeFormDefinition(broken);
      expect(formulasById(repaired)).toEqual(formulasById(correct));
      // Same load path with and without the damage: identical result (only formulas differed).
      expect(repaired).toEqual(normalizeFormDefinition(correct));
      const again = normalizeFormDefinition(repaired);
      expect(formulasById(again)).toEqual(formulasById(repaired));
      expect(formulasById(normalizeFormDefinition(again))).toEqual(formulasById(repaired));
    });

    test(`peruslaskenta ${version}: a correct form keeps its formulas on load`, () => {
      const correct = parseImportedFormDefinition(readTemplate(path));
      expect(formulasById(normalizeFormDefinition(correct))).toEqual(formulasById(correct));
    });
  }

  test('repair only touches formulas: values, prices and other fields stay as they were', () => {
    const correct = parseImportedFormDefinition(readTemplate(TEMPLATES.v123));
    const broken = brokenSavedForm(correct);
    const withoutFormulas = (form: FormDefinition) =>
      form.fields.map(({ formula: _formula, ...rest }) => rest);
    const repairedNow = normalizeFormDefinition(broken);
    const loadedBefore = normalizeFormDefinition(brokenSavedForm(normalizeFormDefinition(correct)));
    expect(withoutFormulas(repairedNow)).toEqual(withoutFormulas(normalizeFormDefinition(correct)));
    expect(repairedNow.pages).toEqual(normalizeFormDefinition(correct).pages);
    expect(withoutFormulas(loadedBefore)).toEqual(withoutFormulas(repairedNow));
  });

  test('an unknown identifier with no defined corrected key is left alone', () => {
    const correct = parseImportedFormDefinition(readTemplate(TEMPLATES.v123));
    const target = correct.fields.find((field) => field.type === 'computed' && field.formula)!;
    const form: FormDefinition = {
      ...correct,
      fields: correct.fields.map((field) =>
        field.id === target.id ? { ...field, formula: 'olematon_materiaalit + materiaalit' } : field,
      ),
    };
    expect(formulaOf(normalizeFormDefinition(form), target.key)).toBe('olematon_materiaalit + materiaalit');
  });
});

describe('peruslaskenta v123 prices (cases from the 23.11.2026 verification)', () => {
  const paint: Product = {
    id: '15a3a629-b764-4e10-bf5e-3ce5e298c1e2',
    name: 'Testimaali (kuvitteellinen)',
    unit: 'l',
    unitPriceVat0: 14,
    purchasePriceVat0: 14,
    attributes: { menekki: 6, tyokerroin: 1 },
    createdAt: new Date(0),
  };
  const roof: Product = {
    id: 'kuvitteellinen-pinnoite',
    name: 'Testipinnoite (kuvitteellinen)',
    unit: 'l',
    unitPriceVat0: 12,
    purchasePriceVat0: 12,
    attributes: { menekki: 5, tyokerroin: 1 },
    createdAt: new Date(0),
  };
  const CASE1 = {
    ikkunanpokat_valinta: '1',
    ikkunat_lkm: '13',
    ovet_valinta: '1',
    ovet_lkm: '2',
    sokkeli_valinta: '1',
    sokkelin_korkeus_m: '0.5',
    sokkelin_tasoitus: '0.03',
    sokkelin_pinnoitus: '0.1',
  };
  const CASE2 = { ...CASE1, tiilikaton_pinnoitus_valinta: '1', tiilikaton_pinnoite: roof.id, katon_kaltevuus: '30' };

  const exampleValues = (form: FormDefinition, extra: Record<string, string>) => {
    const values: Record<string, string> = {};
    for (const field of form.fields) {
      if (field.type === 'computed' || field.type === 'section') continue;
      if (field.debugExampleValue != null && field.debugExampleValue !== '') {
        values[field.key] = String(field.debugExampleValue);
      }
    }
    return { ...values, ...extra };
  };
  const run = (form: FormDefinition, extra: Record<string, string>) =>
    runFormCalculation({
      form,
      fieldValues: exampleValues(form, extra),
      materialLines: [],
      products: [paint, roof],
      settings: defaultSettings,
    }).context;

  const imported = () => parseImportedFormDefinition(readTemplate(TEMPLATES.v123));
  const repairedFromPhone = () => normalizeFormDefinition(brokenSavedForm(imported()));

  for (const [label, load] of [
    ['imported', imported],
    ['repaired saved form', repairedFromPhone],
  ] as const) {
    test(`case 1 (${label}): structure prices are correct`, () => {
      const c = run(load(), CASE1);
      expect(c.kokonaishinta).toBeCloseTo(9322.9, 1);
      expect(c.paatuote_hinta_sis_alv).toBeCloseTo(6122.3, 1);
      expect(c.ikkunanpokat_hinta_sis_alv).toBeCloseTo(2361.65, 1);
      expect(c.ovet_hinta_sis_alv).toBeCloseTo(252.65, 1);
      expect(c.sokkeli_hinta_sis_alv).toBeCloseTo(586.31, 1);
    });

    test(`case 2 (${label}): tiilikatto total is correct (was 460,99 EUR too low)`, () => {
      const c = run(load(), CASE2);
      expect(c.materiaalit).toBeCloseTo(1385.34, 1);
      expect(c.kokonaishinta_alv0).toBeCloseTo(9407.86, 1);
      expect(c.kokonaishinta).toBeCloseTo(11806.86, 1);
      expect(c.tiilikaton_hinta_sis_alv).toBeCloseTo(2605.91, 1);
    });
  }
});
