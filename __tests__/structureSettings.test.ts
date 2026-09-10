import { runProductionPipeline } from '../src/core/calculation/calculationPipeline';
import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { defaultSettings } from '../src/core/models/types';
import { settingsForStructure } from '../src/core/structure/structureSettings';

describe('settingsForStructure', () => {
  test('kaava käyttää tuoterakenteen työryhmän kokoa', () => {
    const form = normalizeFormDefinition(createMinimalFormDefinition());
    form.fields.push({
      id: 'field_crew_check',
      key: 'tyoryhma_tarkistus',
      label: 'Tarkistus',
      type: 'computed',
      required: false,
      showOnSummary: false,
      formula: 'asetukset.tyoryhman_koko',
    });
    const structureSettings = settingsForStructure(defaultSettings, {
      commissionPercent: 9,
      crewSize: 4,
    });
    const context = runProductionPipeline(form, {}, 0, structureSettings);
    expect(context['asetukset.tyoryhman_koko']).toBe(4);
    expect(context['settings.default_crew_size']).toBe(4);
    expect(context.tyoryhma_tarkistus).toBe(4);
    expect(context['asetukset.myyntipalkkio_prosentti']).toBe(9);
  });

  test('eri rakenteilla voi olla eri työryhmän koko', () => {
    const form = normalizeFormDefinition(createMinimalFormDefinition());
    const two = settingsForStructure(defaultSettings, { commissionPercent: 7, crewSize: 2 });
    const five = settingsForStructure(defaultSettings, { commissionPercent: 7, crewSize: 5 });
    expect(runProductionPipeline(form, {}, 0, two)['asetukset.tyoryhman_koko']).toBe(2);
    expect(runProductionPipeline(form, {}, 0, five)['asetukset.tyoryhman_koko']).toBe(5);
  });
});
