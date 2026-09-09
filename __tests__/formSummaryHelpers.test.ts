import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import {
  buildFormSnapshot,
  formatFieldSummaryValue,
  lineFormSnapshot,
  summaryDisplayFields,
} from '../src/core/form/formSummaryHelpers';
import { runProductionPipeline } from '../src/core/calculation/calculationPipeline';
import { defaultSettings } from '../src/core/models/types';

function defaultForm() {
  return normalizeFormDefinition(createMinimalFormDefinition());
}

describe('summaryDisplayFields', () => {
  test('includes only showOnSummary user fields', () => {
    const form = defaultForm();
    const fields = summaryDisplayFields(form);
    const keys = fields.map((field) => field.key);

    expect(keys).toContain('kiintea_seinapinta_ala_m2');
    expect(keys).toContain('laskenta_seinapinta_ala_m2');
    expect(keys).not.toContain('tyoryhma_kesto_h');
  });
});

describe('lineFormSnapshot', () => {
  test('keeps each structure line snapshot separate', () => {
    const form = defaultForm();
    const first = lineFormSnapshot(
      { fieldValues: { kiintea_seinapinta_ala_m2: '120', laudoitustyyppi: '1.15' } },
      form,
      [],
      { kiintea_seinapinta_ala_m2: 120, laudoitustyyppi: 1.15 },
    );
    const second = lineFormSnapshot(
      { fieldValues: { kiintea_seinapinta_ala_m2: '40', laudoitustyyppi: '1' } },
      form,
      [],
      { kiintea_seinapinta_ala_m2: 40, laudoitustyyppi: 1 },
    );

    expect(first?.fields.find((field) => field.key === 'kiintea_seinapinta_ala_m2')?.value).toContain(
      '120',
    );
    expect(second?.fields.find((field) => field.key === 'kiintea_seinapinta_ala_m2')?.value).toContain(
      '40',
    );
  });

  test('prefers a stored snapshot over rebuilding from live values', () => {
    const form = defaultForm();
    const stored = buildFormSnapshot(form, { kiintea_seinapinta_ala_m2: '10' }, {
      kiintea_seinapinta_ala_m2: 10,
    });
    const resolved = lineFormSnapshot(
      {
        snapshot: stored,
        fieldValues: { kiintea_seinapinta_ala_m2: '99' },
      },
      form,
      [],
      { kiintea_seinapinta_ala_m2: 99 },
    );
    expect(resolved).toBe(stored);
  });
});

describe('buildFormSnapshot', () => {
  test('captures formatted values grouped by page', () => {
    const form = defaultForm();
    const fieldValues = {
      kiintea_seinapinta_ala_m2: '120',
      aukkovahennykset: '18',
      laudoitustyyppi: '1.15',
      tyoryhma_kesto_pv: '5',
    };
    const context = runProductionPipeline(form, fieldValues, 250, defaultSettings);
    const snapshot = buildFormSnapshot(form, fieldValues, context);

    expect(snapshot.formId).toBe(form.id);
    expect(snapshot.fields.some((field) => field.key === 'laskenta_seinapinta_ala_m2')).toBe(true);
    expect(
      snapshot.fields.find((field) => field.key === 'laskenta_seinapinta_ala_m2')?.value,
    ).toContain('117');
    expect(snapshot.fields.find((field) => field.key === 'laudoitustyyppi')?.value).toBe('Paneeli');
    expect(snapshot.fieldValues).toEqual(fieldValues);
  });
});

describe('formatFieldSummaryValue', () => {
  test('formats select as option label', () => {
    const form = defaultForm();
    const field = form.fields.find((item) => item.key === 'laudoitustyyppi')!;

    expect(
      formatFieldSummaryValue(field, { laudoitustyyppi: '1.15' }, { laudoitustyyppi: 1.15 }),
    ).toBe('Paneeli');
    expect(formatFieldSummaryValue(field, {}, {})).toBe('–');
  });

  test('formats boolean as Kyllä/Ei', () => {
    const form = defaultForm();
    form.fields.push({
      id: 'field_bool',
      key: 'test_bool',
      label: 'Test',
      type: 'boolean',
      required: false,
      showOnSummary: true,
    });

    const field = form.fields.find((item) => item.key === 'test_bool')!;
    expect(formatFieldSummaryValue(field, { test_bool: 'true' }, {})).toBe('Kyllä');
    expect(formatFieldSummaryValue(field, { test_bool: 'false' }, {})).toBe('Ei');
  });

  test('ceils work duration days on summary', () => {
    const field = {
      id: 'field_system_tyoryhma_kesto_pv',
      key: 'tyoryhma_kesto_pv',
      systemKey: 'tyoryhma_kesto_pv',
      label: 'Työn kesto',
      type: 'computed' as const,
      required: false,
      showOnSummary: true,
      unit: 'pv',
    };

    expect(formatFieldSummaryValue(field, {}, { tyoryhma_kesto_pv: 1.1 })).toBe('2 pv');
    expect(formatFieldSummaryValue(field, {}, { tyoryhma_kesto_pv: 1 })).toBe('1 pv');
  });

  test('summaryDisplayFields omits fields hidden by showWhen', () => {
    const form = defaultForm();
    form.fields.push(
      {
        id: 'field_bool',
        key: 'raystaat',
        label: 'Räystäät',
        type: 'boolean',
        required: false,
        showOnSummary: true,
      },
      {
        id: 'field_metrit',
        key: 'raystasmetrit',
        label: 'Räystäsmetrit',
        type: 'number',
        required: false,
        showOnSummary: true,
        showWhen: { fieldKey: 'raystaat', value: 'true' },
      },
    );
    form.pages[0].fieldIds.push('field_bool', 'field_metrit');

    const hidden = summaryDisplayFields(form, { raystaat: 'false' }).map((f) => f.key);
    expect(hidden).not.toContain('raystasmetrit');

    const shown = summaryDisplayFields(form, { raystaat: 'true' }).map((f) => f.key);
    expect(shown).toContain('raystasmetrit');
  });

  test('showOnSummaryWhen omits a wizard-visible field from summary until the condition matches', () => {
    const form = defaultForm();
    form.fields.push(
      {
        id: 'field_bool',
        key: 'lisatyot',
        label: 'Lisätyöt',
        type: 'boolean',
        required: false,
        showOnSummary: true,
      },
      {
        id: 'field_desc',
        key: 'lisatyot_kuvaus',
        label: 'Lisätöiden kuvaus',
        type: 'text',
        required: false,
        showOnSummary: true,
        showOnSummaryWhen: { fieldKey: 'lisatyot', operator: 'eq', value: 'true' },
      },
    );
    form.pages[0].fieldIds.push('field_bool', 'field_desc');

    const hidden = summaryDisplayFields(form, { lisatyot: 'false' }).map((field) => field.key);
    expect(hidden).toContain('lisatyot');
    expect(hidden).not.toContain('lisatyot_kuvaus');

    const shown = summaryDisplayFields(form, { lisatyot: 'true' }).map((field) => field.key);
    expect(shown).toContain('lisatyot_kuvaus');
  });
});
