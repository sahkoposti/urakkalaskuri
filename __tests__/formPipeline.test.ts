import { evaluateFormula, FormulaEvaluationError } from '../src/core/form/formula/evaluator';
import { sortComputedFields } from '../src/core/form/formula/dependencies';
import {
  addField,
  addPage,
  createFieldDraft,
  createPageDraft,
  moveField,
  movePage,
  removeField,
  removePage,
  uniqueFieldKey,
  validateFieldKey,
} from '../src/core/form/formEditor';
import { runDebugPipeline, runPipeline } from '../src/core/form/pipeline';
import { createDefaultFormDefinition, createSurfaceExampleForm } from '../src/core/form/defaultFormDefinition';
import { createCladdingFormDefinition } from '../src/core/form/claddingFormDefinition';
import { defaultFormDefaults } from '../src/core/form/formDefaults';
import type { FormDefinition, FormField } from '../src/core/form/types';
import { defaultSettings, type Product } from '../src/core/models/types';

describe('evaluateFormula', () => {
  test('evaluates basic arithmetic', () => {
    expect(evaluateFormula('(120 - 18) * 1.15', {})).toBeCloseTo(117.3, 2);
  });

  test('uses context variables', () => {
    expect(
      evaluateFormula('kiinteä_seinäpinta_ala_m2 - aukkovähennykset', {
        kiinteä_seinäpinta_ala_m2: 120,
        aukkovähennykset: 18,
      }),
    ).toBe(102);
  });

  test('supports dotted product attributes', () => {
    expect(
      evaluateFormula('pinta_ala / kautettavamaali.consumption', {
        pinta_ala: 120,
        'kautettavamaali.consumption': 8,
      }),
    ).toBe(15);
  });

  test('supports min, max and round', () => {
    expect(evaluateFormula('min(3, 1, 2)', {})).toBe(1);
    expect(evaluateFormula('max(pinta_ala, 100)', { pinta_ala: 120 })).toBe(120);
    expect(evaluateFormula('round(1.49)', {})).toBe(1);
    expect(evaluateFormula('round(1.234, 2)', {})).toBeCloseTo(1.23, 5);
  });

  test('rejects unknown variables', () => {
    expect(() => evaluateFormula('puuttuva + 1', {})).toThrow(FormulaEvaluationError);
  });
});

describe('runDebugPipeline', () => {
  test('combines per-field debug examples through full chain', () => {
    const form = createSurfaceExampleForm();
    const trace = runDebugPipeline(form, 'laskenta_seinäpinta_ala_m2');

    expect(trace.errors).toHaveLength(0);
    expect(trace.context.laskenta_seinäpinta_ala_m2).toBeCloseTo(117.3, 2);
    expect(trace.steps.some((step) => step.fieldKey === 'laskenta_seinäpinta_ala_m2')).toBe(true);
  });

  test('reports missing debug example for required field', () => {
    const form = createSurfaceExampleForm();
    form.fields = form.fields.map((field) =>
      field.key === 'kiinteä_seinäpinta_ala_m2'
        ? { ...field, debugExampleValue: undefined }
        : field,
    );
    const trace = runDebugPipeline(form);

    expect(trace.errors.some((error) => error.includes('Kiinteä seinäpinta-ala'))).toBe(true);
  });
});

const paint: Product = {
  id: 'paint-1',
  name: 'Ulkomaali',
  unit: 'l',
  unitPriceVat0: 12,
  createdAt: new Date(0),
  attributes: { consumption: 8 },
};

function paintForm(): FormDefinition {
  return {
    id: 'paint-form',
    name: 'Maali',
    version: 1,
    updatedAt: 0,
    pages: [{ id: 'p1', title: 'Pinta', sortOrder: 0 }],
    fields: [
      {
        id: 'f1',
        pageId: 'p1',
        key: 'pinta_ala',
        label: 'Pinta-ala',
        type: 'number',
        sortOrder: 0,
        required: true,
        showOnSummary: true,
        unit: 'm²',
      },
      {
        id: 'f2',
        pageId: 'p1',
        key: 'kautettavamaali',
        label: 'Kautettava maali',
        type: 'product_select',
        sortOrder: 1,
        required: true,
        showOnSummary: false,
      },
      {
        id: 'f3',
        pageId: 'p1',
        key: 'materiaali_maara',
        label: 'Materiaalimäärä',
        type: 'computed',
        sortOrder: 2,
        required: false,
        showOnSummary: true,
        unit: 'l',
        formula: 'pinta_ala / kautettavamaali.consumption',
        effects: [
          {
            type: 'add_material',
            productRef: 'kautettavamaali',
            quantityRef: 'materiaali_maara',
          },
        ],
      },
      {
        id: 'f4',
        pageId: 'p1',
        key: 'työryhmän_kesto_pv',
        label: 'Kesto',
        type: 'number',
        sortOrder: 3,
        required: true,
        showOnSummary: true,
        unit: 'pv',
      },
    ],
  };
}

describe('runPipeline', () => {
  test('computes material quantity from product consumption and adds a material line', () => {
    const result = runPipeline({
      formDefinition: paintForm(),
      fieldValues: {
        pinta_ala: 120,
        kautettavamaali: 'paint-1',
        työryhmän_kesto_pv: 5,
      },
      settings: defaultSettings,
      products: [paint],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.context.materiaali_maara).toBeCloseTo(15);
    expect(result.materialLines).toHaveLength(1);
    expect(result.materialLines[0]?.quantity).toBeCloseTo(15);
    expect(result.materialsVat0).toBeCloseTo(180);
    expect(result.groupDurationHours).toBeCloseTo(40);
    expect(result.calculation?.contractPriceVat0).toBeCloseTo(2400);
  });

  test('adds a direct product_quantity line', () => {
    const form: FormDefinition = {
      id: 'qty',
      name: 'qty',
      version: 1,
      updatedAt: 0,
      pages: [{ id: 'p1', title: 'Materiaalit', sortOrder: 0 }],
      fields: [
        {
          id: 'f1',
          pageId: 'p1',
          key: 'maali',
          label: 'Maali',
          type: 'product_quantity',
          sortOrder: 0,
          required: false,
          showOnSummary: true,
        },
        {
          id: 'f2',
          pageId: 'p1',
          key: 'työryhmän_kesto_pv',
          label: 'Kesto',
          type: 'number',
          sortOrder: 1,
          required: true,
          showOnSummary: true,
        },
      ],
    };

    const result = runPipeline({
      formDefinition: form,
      fieldValues: {
        maali: { productId: 'paint-1', quantity: 5 },
        työryhmän_kesto_pv: 1,
      },
      settings: defaultSettings,
      products: [paint],
    });

    expect(result.errors).toHaveLength(0);
    expect(result.materialsVat0).toBeCloseTo(60);
    expect(result.materialLines[0]?.productName).toBe('Ulkomaali');
  });

  test('multiplies duration from select workFactor', () => {
    const form: FormDefinition = {
      id: 'wf',
      name: 'wf',
      version: 1,
      updatedAt: 0,
      pages: [{ id: 'p1', title: 'Työ', sortOrder: 0 }],
      fields: [
        {
          id: 'f1',
          pageId: 'p1',
          key: 'työryhmän_kesto_pv',
          label: 'Kesto',
          type: 'number',
          sortOrder: 0,
          required: true,
          showOnSummary: true,
        },
        {
          id: 'f2',
          pageId: 'p1',
          key: 'vaikeus',
          label: 'Vaikeus',
          type: 'select',
          sortOrder: 1,
          required: true,
          showOnSummary: true,
          options: [
            { label: 'Normaali', value: 'normaali', workFactor: 1 },
            { label: 'Vaikea', value: 'vaikea', workFactor: 1.5 },
          ],
        },
      ],
    };

    const result = runPipeline({
      formDefinition: form,
      fieldValues: { työryhmän_kesto_pv: 2, vaikeus: 'vaikea' },
      settings: defaultSettings,
      products: [],
    });

    expect(result.groupDurationHours).toBeCloseTo(2 * 8 * 1.5);
  });

  test('reports missing product for formula attribute', () => {
    const result = runPipeline({
      formDefinition: paintForm(),
      fieldValues: {
        pinta_ala: 120,
        työryhmän_kesto_pv: 5,
      },
      settings: defaultSettings,
      products: [paint],
    });

    expect(result.errors.some((error) => error.includes('Kautettava maali'))).toBe(true);
    expect(result.materialLines).toHaveLength(0);
    expect(result.steps.some((step) => step.fieldKey === 'materiaali_maara' && step.error)).toBe(true);
  });

  test('orders computed fields by dependency, not list order', () => {
    const fields: FormField[] = [
      {
        id: 'a',
        pageId: 'p1',
        key: 'tulos',
        label: 'Tulos',
        type: 'computed',
        sortOrder: 0,
        required: false,
        showOnSummary: true,
        formula: 'vali + 1',
      },
      {
        id: 'b',
        pageId: 'p1',
        key: 'vali',
        label: 'Väli',
        type: 'computed',
        sortOrder: 1,
        required: false,
        showOnSummary: false,
        formula: 'pohja * 2',
      },
      {
        id: 'c',
        pageId: 'p1',
        key: 'pohja',
        label: 'Pohja',
        type: 'number',
        sortOrder: 2,
        required: true,
        showOnSummary: false,
      },
      {
        id: 'd',
        pageId: 'p1',
        key: 'työryhmän_kesto_pv',
        label: 'Kesto',
        type: 'number',
        sortOrder: 3,
        required: true,
        showOnSummary: true,
      },
    ];

    const ordered = sortComputedFields(fields).map((field) => field.key);
    expect(ordered).toEqual(['vali', 'tulos']);

    const result = runPipeline({
      formDefinition: {
        id: 'dep',
        name: 'dep',
        version: 1,
        updatedAt: 0,
        pages: [{ id: 'p1', title: 'x', sortOrder: 0 }],
        fields,
      },
      fieldValues: { pohja: 10, työryhmän_kesto_pv: 1 },
      settings: defaultSettings,
      products: [],
    });

    expect(result.context.tulos).toBe(21);
  });

  test('filters summary fields by showOnSummary', () => {
    const result = runPipeline({
      formDefinition: paintForm(),
      fieldValues: {
        pinta_ala: 120,
        kautettavamaali: 'paint-1',
        työryhmän_kesto_pv: 5,
      },
      settings: defaultSettings,
      products: [paint],
    });

    const keys = result.summaryFields.map((field) => field.key);
    expect(keys).toContain('pinta_ala');
    expect(keys).toContain('materiaali_maara');
    expect(keys).not.toContain('kautettavamaali');
  });
});

describe('formEditor', () => {
  test('adds, moves and removes user pages without deleting system pages', () => {
    let form = createDefaultFormDefinition();
    const systemCount = form.pages.filter((page) => page.system).length;
    form = addPage(form, createPageDraft('page_new', form, 'Lisäosat'));

    const added = form.pages.find((page) => page.id === 'page_new');
    expect(added?.title).toBe('Lisäosat');

    form = movePage(form, 'page_new', -1);
    const titles = [...form.pages].sort((a, b) => a.sortOrder - b.sortOrder).map((page) => page.id);
    expect(titles.indexOf('page_new')).toBeGreaterThanOrEqual(0);

    form = removePage(form, 'page_customer');
    expect(form.pages.filter((page) => page.system).length).toBe(systemCount);

    form = removePage(form, 'page_new');
    expect(form.pages.some((page) => page.id === 'page_new')).toBe(false);
  });

  test('adds unique field keys and reorders fields on a page', () => {
    let form = createDefaultFormDefinition();
    const first = createFieldDraft('nf1', form, 'page_duration');
    form = addField(form, first);
    const second = createFieldDraft('nf2', form, 'page_duration');
    expect(second.key).not.toBe(first.key);
    form = addField(form, second);

    const before = form.fields
      .filter((field) => field.pageId === 'page_duration')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((field) => field.id);
    form = moveField(form, second.id, -1);
    const after = form.fields
      .filter((field) => field.pageId === 'page_duration')
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((field) => field.id);
    expect(after.indexOf(second.id)).toBeLessThan(before.indexOf(second.id));

    form = removeField(form, first.id);
    expect(form.fields.some((field) => field.id === first.id)).toBe(false);
  });

  test('validates field keys', () => {
    const form = createDefaultFormDefinition();
    expect(validateFieldKey(form, 'työryhmän_kesto_pv')).toBeTruthy();
    expect(validateFieldKey(form, 'Uusi Key')).toBeTruthy();
    expect(validateFieldKey(form, 'uusi_kentta')).toBeNull();
    expect(uniqueFieldKey(form, 'Kesto')).not.toBe('työryhmän_kesto_pv');
  });
});

describe('default and cladding forms', () => {
  test('Peruslaskenta has customer, duration and materials pages', () => {
    const form = createDefaultFormDefinition();
    expect(form.pages.map((page) => page.id)).toEqual([
      'page_customer',
      'page_duration',
      'page_materials',
    ]);
    const result = runPipeline({
      formDefinition: form,
      fieldValues: { työryhmän_kesto_pv: 5 },
      settings: defaultSettings,
      products: [],
    });
    expect(result.errors).toHaveLength(0);
    expect(result.groupDurationHours).toBe(40);
    expect(result.calculation?.contractPriceVat0).toBeCloseTo(2400);
  });

  test('Ulkoverhous computes PDF wall area and eaves from defaults', () => {
    const form = createCladdingFormDefinition();
    const trace = runDebugPipeline(form, {
      defaults: defaultFormDefaults,
      products: [paint],
    });

    expect(trace.context.laskenta_seinäpinta_ala_m2).toBeCloseTo(117.3, 2);
    expect(trace.context.räystäspinta_ala).toBeCloseTo(10, 2);
    expect(trace.context.aukko_laskettu_m2).toBeCloseTo(3 * 1.2 * 1.4 + 2 * 0.9 * 2.1, 2);
  });

  test('Ulkoverhous paint formula adds a material line when product is selected', () => {
    const form = createCladdingFormDefinition();
    const values = {
      kiinteä_seinäpinta_ala_m2: 120,
      aukkovähennykset: 18,
      laudoitustyyppi: 'paneeli',
      kautettavamaali: 'paint-1',
      työryhmän_kesto_pv: 5,
    };
    const result = runPipeline({
      formDefinition: form,
      fieldValues: values,
      settings: defaultSettings,
      defaults: defaultFormDefaults,
      products: [paint],
    });

    expect(result.context.materiaali_maara).toBeCloseTo(117.3 / 8, 2);
    expect(result.materialLines.some((line) => line.productId === 'paint-1')).toBe(true);
  });

  test('merges extra material lines into pipeline totals', () => {
    const form = createDefaultFormDefinition();
    const result = runPipeline({
      formDefinition: form,
      fieldValues: { työryhmän_kesto_pv: 5 },
      settings: defaultSettings,
      products: [paint],
      extraMaterialLines: [
        {
          id: 'extra_1',
          productId: paint.id,
          productName: paint.name,
          unit: paint.unit,
          unitPriceVat0: paint.unitPriceVat0,
          quantity: 2,
          lineTotalVat0: 24,
        },
      ],
    });

    expect(result.materialsVat0).toBeCloseTo(24);
    expect(result.materialLines).toHaveLength(1);
  });
});
