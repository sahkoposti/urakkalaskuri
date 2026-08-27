import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import {
  FormDefinitionImportError,
  parseImportedFormDefinition,
  serializeFormDefinition,
} from '../src/core/form/formDefinitionIo';
import {
  fieldsForPage,
  normalizeFormDefinition,
  unknownFormulaIdentifiers,
} from '../src/core/form/formDefinitionHelpers';

describe('formDefinitionIo', () => {
  test('round-trips default form through serialize/parse', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const json = serializeFormDefinition(form);
    const imported = parseImportedFormDefinition(json);

    expect(imported.name).toBe(form.name);
    expect(imported.pages.length).toBe(form.pages.length);
    expect(imported.fields.some((field) => field.key === 'tyoryhma_kesto_pv')).toBe(true);
  });

  test('coerces boolean and numeric showWhen values to strings', () => {
    const imported = parseImportedFormDefinition(
      JSON.stringify({
        id: 'imported',
        name: 'Tuonti',
        version: 1,
        pages: [{ id: 'p1', title: 'Sivu', sortOrder: 0, fieldIds: ['f1', 'f2'] }],
        fields: [
          {
            id: 'f1',
            key: 'kaytossa',
            label: 'Käytössä',
            type: 'boolean',
            required: false,
            showOnSummary: true,
          },
          {
            id: 'f2',
            key: 'maara',
            label: 'Määrä',
            type: 'number',
            required: false,
            showOnSummary: true,
            showWhen: { fieldKey: 'kaytossa', operator: 'eq', value: true },
          },
        ],
        updatedAt: 1,
      }),
    );

    expect(imported.fields.find((field) => field.id === 'f2')?.showWhen?.value).toBe('true');
  });

  test('rejects invalid payload', () => {
    expect(() => parseImportedFormDefinition('')).toThrow(FormDefinitionImportError);
    expect(() => parseImportedFormDefinition('{')).toThrow(FormDefinitionImportError);
    expect(() => parseImportedFormDefinition('{"name":"x"}')).toThrow(FormDefinitionImportError);
  });
});

describe('unknownFormulaIdentifiers with builtins', () => {
  test('min max round if are not unknown identifiers', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    expect(
      unknownFormulaIdentifiers(
        form,
        'if(kiintea_seinapinta_ala_m2 > 100, max(1, round(1.234, 2)), min(0, 1))',
      ),
    ).toEqual([]);
  });

  test('sqrt is a known formula function', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    expect(unknownFormulaIdentifiers(form, 'sqrt(9)')).toEqual([]);
  });
});

describe('imported Peruslaskenta reserved pricing fields', () => {
  test('keeps sliding-margin formula and shows page-assigned hidden keys', () => {
    const imported = parseImportedFormDefinition(
      JSON.stringify({
        id: 'default',
        name: 'Peruslaskenta',
        version: 83,
        pages: [
          {
            id: 'page_pricing',
            title: 'Hinnoittelu',
            sortOrder: 0,
            fieldIds: [
              'field_system_kokonaishinta_alv0',
              'field_system_myyntipalkkio',
              'field_system_myyntikate',
              'field_system_alv',
              'field_system_kokonaishinta',
            ],
          },
        ],
        fields: [
          {
            id: 'field_system_kokonaishinta_alv0',
            key: 'kokonaishinta_alv0',
            label: 'Myyntihinta (ALV 0)',
            type: 'computed',
            required: false,
            showOnSummary: true,
            allowManualOverride: true,
            formula: 'if(suorat_kustannukset_alv0 <= 1, 1, sqrt(suorat_kustannukset_alv0))',
          },
          {
            id: 'field_system_myyntipalkkio',
            key: 'myyntipalkkio',
            label: 'Myyntipalkkio (ALV 0)',
            type: 'computed',
            required: false,
            showOnSummary: true,
            formula: 'kokonaishinta_alv0 * asetukset.myyntipalkkio_prosentti / 100',
          },
          {
            id: 'field_system_myyntikate',
            key: 'myyntikate',
            label: 'Yrityksen kate (€)',
            type: 'computed',
            required: false,
            showOnSummary: true,
            formula: 'kokonaishinta_alv0 - suorat_kustannukset_alv0 - myyntipalkkio',
          },
          {
            id: 'field_system_alv',
            key: 'alv_maara',
            label: 'ALV (€)',
            type: 'computed',
            required: false,
            showOnSummary: true,
            formula: 'kokonaishinta_alv0 * asetukset.alv_prosentti / 100',
          },
          {
            id: 'field_system_kokonaishinta',
            systemKey: 'kokonaishinta',
            key: 'kokonaishinta',
            label: 'Kokonaishinta (sis. ALV)',
            type: 'computed',
            required: false,
            showOnSummary: true,
            formula: 'kokonaishinta_alv0 + alv_maara',
          },
          {
            id: 'field_cost',
            key: 'suorat_kustannukset_alv0',
            label: 'Suorat kustannukset',
            type: 'number',
            required: false,
            showOnSummary: true,
          },
        ],
        updatedAt: 1,
      }),
    );

    const alv0 = imported.fields.find((field) => field.key === 'kokonaishinta_alv0');
    expect(alv0?.formula).toContain('sqrt');
    expect(alv0?.systemKey).toBe('kokonaishinta_alv0');

    const pricingIds = fieldsForPage(imported, 'page_pricing').map((field) => field.key);
    expect(pricingIds).toEqual(
      expect.arrayContaining([
        'kokonaishinta_alv0',
        'myyntipalkkio',
        'myyntikate',
        'alv_maara',
        'kokonaishinta',
      ]),
    );

    for (const field of imported.fields) {
      if (!field.formula) continue;
      expect(unknownFormulaIdentifiers(imported, field.formula)).toEqual([]);
    }
  });
});
