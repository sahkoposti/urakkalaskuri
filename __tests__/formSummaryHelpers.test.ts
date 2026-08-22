import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import {
  buildFormSnapshot,
  formatFieldSummaryValue,
  summaryDisplayFields,
} from '../src/core/form/formSummaryHelpers';
import { runProductionPipeline } from '../src/core/calculation/calculationPipeline';
import { defaultSettings } from '../src/core/models/types';

function defaultForm() {
  return normalizeFormDefinition(createDefaultFormDefinition());
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
  });
});

describe('formatFieldSummaryValue', () => {
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
});
