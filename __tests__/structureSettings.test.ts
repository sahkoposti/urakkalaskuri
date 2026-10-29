import { runProductionPipeline } from '../src/core/calculation/calculationPipeline';
import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { buildSettingsFormulaContext } from '../src/core/form/settingsFormulaContext';
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

  test('kaava käyttää tuoterakenteen liukuvaa katetta', () => {
    const form = normalizeFormDefinition(createMinimalFormDefinition());
    form.fields.push({
      id: 'field_margin_check',
      key: 'kate_tarkistus',
      label: 'Tarkistus',
      type: 'computed',
      required: false,
      showOnSummary: false,
      formula: 'asetukset.myyntikate_alaraja_prosentti',
    });
    const structureSettings = settingsForStructure(defaultSettings, {
      commissionPercent: 9,
      crewSize: 2,
      marginLowAmount: 1500,
      marginLowPercent: 40,
      marginHighAmount: 8000,
      marginHighPercent: 22,
    });
    const context = runProductionPipeline(form, {}, 0, structureSettings);
    expect(context['asetukset.myyntikate_alaraja_eur']).toBe(1500);
    expect(context['asetukset.myyntikate_alaraja_prosentti']).toBe(40);
    expect(context['asetukset.myyntikate_ylaraja_eur']).toBe(8000);
    expect(context['asetukset.myyntikate_ylaraja_prosentti']).toBe(22);
    expect(context['asetukset.myyntikate_prosentti']).toBe(40);
    expect(context.kate_tarkistus).toBe(40);
  });

  test('eri rakenteilla voi olla eri kate', () => {
    const form = normalizeFormDefinition(createMinimalFormDefinition());
    const high = settingsForStructure(defaultSettings, {
      commissionPercent: 7,
      crewSize: 2,
      marginLowPercent: 50,
    });
    const low = settingsForStructure(defaultSettings, {
      commissionPercent: 7,
      crewSize: 2,
      marginLowPercent: 25,
    });
    expect(runProductionPipeline(form, {}, 0, high)['asetukset.myyntikate_alaraja_prosentti']).toBe(50);
    expect(runProductionPipeline(form, {}, 0, low)['asetukset.myyntikate_alaraja_prosentti']).toBe(25);
  });

  test('kaava käyttää tuoterakenteen tuntipalkkaa', () => {
    const resolved = settingsForStructure(defaultSettings, {
      commissionPercent: 7,
      crewSize: 2,
      hourlyRate: 40,
    });
    expect(resolved.defaultHourlyRate).toBe(40);
    expect(buildSettingsFormulaContext(resolved)['asetukset.tuntihinta']).toBe(40);
    expect(buildSettingsFormulaContext(resolved)['settings.default_hourly_rate']).toBe(40);
  });

  test('tyhjä, nolla ja NaN käyttävät Yleinen-tuntipalkkaa', () => {
    const base = { ...defaultSettings, defaultHourlyRate: 30 };
    for (const hourlyRate of [undefined, 0, Number.NaN]) {
      const resolved = settingsForStructure(base, {
        commissionPercent: 7,
        crewSize: 2,
        hourlyRate,
      });
      expect(resolved.defaultHourlyRate).toBe(30);
    }
  });

  test('oletus urakka_hinta_alv0 eroaa rakenteen tuntipalkalla 40 ja yleisellä 30', () => {
    const form = normalizeFormDefinition(createMinimalFormDefinition());
    const values = { tyoryhma_kesto_pv: '5' };
    const general = runProductionPipeline(form, values, 0, defaultSettings);
    const structured = runProductionPipeline(
      form,
      values,
      0,
      settingsForStructure(defaultSettings, {
        commissionPercent: defaultSettings.defaultCommissionPercent,
        crewSize: defaultSettings.defaultCrewSize,
        hourlyRate: 40,
      }),
    );

    expect(defaultSettings.defaultHourlyRate).toBe(30);
    expect(general['asetukset.tuntihinta']).toBe(30);
    expect(structured['asetukset.tuntihinta']).toBe(40);
    // 5 pv * 8 h * työryhmä 2 * tuntihinta
    expect(general.urakka_hinta_alv0).toBeCloseTo(2400, 2);
    expect(structured.urakka_hinta_alv0).toBeCloseTo(3200, 2);
    expect(structured.urakka_hinta_alv0).not.toBe(general.urakka_hinta_alv0);
  });
});
