import {
  FormDefinitionImportError,
  parseImportedFormDefinition,
  serializeFormDefinition,
} from '../src/core/form/formDefinitionIo';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition, unknownFormulaIdentifiers } from '../src/core/form/formDefinitionHelpers';

describe('formDefinitionIo', () => {
  test('round-trips default form through serialize/parse', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const json = serializeFormDefinition(form);
    const imported = parseImportedFormDefinition(json);

    expect(imported.name).toBe(form.name);
    expect(imported.pages.length).toBe(form.pages.length);
    expect(imported.fields.some((field) => field.key === 'tyoryhma_kesto_pv')).toBe(true);
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
});
