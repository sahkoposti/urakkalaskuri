import { runProductionPipeline } from '../src/core/calculation/calculationPipeline';
import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { buildSettingsFormulaContext } from '../src/core/form/settingsFormulaContext';
import peruslaskenta from '../docs/examples/urakkalaskuri_peruslaskenta_v121.json';
import { defaultSettings } from '../src/core/models/types';
import {
  formatHourlyRate,
  HOURLY_RATE_FIELD,
  hourlyRatePlaceholder,
  MAX_HOURLY_RATE,
  parseHourlyRate,
  parseHourlyRateInput,
  settingsForStructure,
} from '../src/core/structure/structureSettings';
import type { FormField } from '../src/core/form/types';

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

  test('oletus urakka ja peruslaskennan asiakashinta ennen ja jälkeen rakenteen tuntipalkan', () => {
    const templateFields = (
      peruslaskenta as { fields: Array<{ key: string; formula?: string; label: string }> }
    ).fields;
    const customerPrice = templateFields.find((field) => field.key === 'ikkunanpokat_hinta_sis_alv');
    expect(customerPrice?.formula).toContain('asetukset.tuntihinta');

    const form = normalizeFormDefinition(createMinimalFormDefinition());
    const input = (key: string): FormField => ({
      id: `field_${key}`,
      key,
      label: key,
      type: 'number',
      required: false,
      showOnSummary: false,
    });
    form.fields.push(
      input('ikkunanpokat_valinta'),
      input('tuotehintakerroin_sis_alv'),
      input('ikkunanpokat_tyo_h'),
      input('ikkunanpokat_materiaalit_alv0'),
      {
        id: 'field_ikkunanpokat_hinta_sis_alv',
        key: 'ikkunanpokat_hinta_sis_alv',
        label: customerPrice?.label ?? 'Ikkunanpokat',
        type: 'computed',
        required: false,
        showOnSummary: true,
        formula: customerPrice?.formula,
      },
    );

    const values = {
      tyoryhma_kesto_pv: '5',
      ikkunanpokat_valinta: '1',
      tuotehintakerroin_sis_alv: '2',
      ikkunanpokat_tyo_h: '10',
      ikkunanpokat_materiaalit_alv0: '5',
    };
    const pricing = {
      commissionPercent: defaultSettings.defaultCommissionPercent,
      crewSize: defaultSettings.defaultCrewSize,
    };
    const before = runProductionPipeline(
      form,
      values,
      0,
      settingsForStructure(defaultSettings, pricing),
    );
    const after = runProductionPipeline(
      form,
      values,
      0,
      settingsForStructure(defaultSettings, { ...pricing, hourlyRate: 40 }),
    );
    const otherStructure = runProductionPipeline(
      form,
      values,
      0,
      settingsForStructure(defaultSettings, { ...pricing, hourlyRate: undefined }),
    );

    expect(defaultSettings.defaultHourlyRate).toBe(30);
    expect(before['asetukset.tuntihinta']).toBe(30);
    expect(before.urakka_hinta_alv0).toBeCloseTo(2400, 2);
    expect(before.ikkunanpokat_hinta_sis_alv).toBeCloseTo(2 * (10 * 30 + 5), 2);
    expect(after['asetukset.tuntihinta']).toBe(40);
    expect(after.urakka_hinta_alv0).toBeCloseTo(3200, 2);
    expect(after.ikkunanpokat_hinta_sis_alv).toBeCloseTo(2 * (10 * 40 + 5), 2);
    expect(after.urakka_hinta_alv0).not.toBe(before.urakka_hinta_alv0);
    expect(after.ikkunanpokat_hinta_sis_alv).not.toBe(before.ikkunanpokat_hinta_sis_alv);
    expect(otherStructure.urakka_hinta_alv0).toBeCloseTo(before.urakka_hinta_alv0, 2);
    expect(otherStructure.ikkunanpokat_hinta_sis_alv).toBeCloseTo(before.ikkunanpokat_hinta_sis_alv, 2);
  });
});

describe('parseHourlyRate', () => {
  const fallback = 30;

  test('näyttää tallennetun arvon pilkkudesimaalina ja paikkamerkin yleisestä hinnasta', () => {
    expect(MAX_HOURLY_RATE).toBe(500);
    expect(HOURLY_RATE_FIELD.label).toBe('Tuntihinta, €/h (alv 0 %)');
    expect(formatHourlyRate(45.5)).toBe('45,5');
    expect(hourlyRatePlaceholder(30)).toBe('30');
    expect(hourlyRatePlaceholder(30.5)).toBe('30,5');
  });

  test('hyväksyy pelkän desimaalin pisteellä tai pilkulla', () => {
    expect(parseHourlyRateInput('45')).toBe(45);
    expect(parseHourlyRateInput('45,5')).toBe(45.5);
    expect(parseHourlyRateInput('45.5')).toBe(45.5);
    expect(parseHourlyRate('45', fallback)).toBe(45);
    expect(parseHourlyRate('45,5', fallback)).toBe(45.5);
    expect(parseHourlyRate('45.5', fallback)).toBe(45.5);
    expect(parseHourlyRate(45.5, fallback)).toBe(45.5);
    expect(parseHourlyRate(500, fallback)).toBe(500);
    expect(parseHourlyRate('500', fallback)).toBe(500);
  });

  test('hylkää virheelliset merkkijonot, nollan ja yli 500', () => {
    for (const raw of ['45abc', '4 5', '1e2', '-3', 'NaN', 'Infinity', '0', '500.01', '500,01']) {
      expect(parseHourlyRateInput(raw)).toBe('invalid');
      expect(parseHourlyRate(raw, fallback)).toBe(fallback);
    }
    expect(parseHourlyRate(0, fallback)).toBe(fallback);
    expect(parseHourlyRate(500.01, fallback)).toBe(fallback);
    expect(parseHourlyRate(Number.NaN, fallback)).toBe(fallback);
    expect(parseHourlyRate(Number.POSITIVE_INFINITY, fallback)).toBe(fallback);
    expect(parseHourlyRateInput('')).toBeNull();
    expect(parseHourlyRateInput('   ')).toBeNull();
    expect(parseHourlyRate('', fallback)).toBe(fallback);
    expect(parseHourlyRate('   ', fallback)).toBe(fallback);
    expect(parseHourlyRate(undefined, fallback)).toBe(fallback);
  });

  test('settingsForStructure hylkää yli rajan olevan tallennetun hinnan', () => {
    const resolved = settingsForStructure(
      { ...defaultSettings, defaultHourlyRate: fallback },
      { commissionPercent: 7, crewSize: 2, hourlyRate: 500.01 },
    );
    expect(resolved.defaultHourlyRate).toBe(fallback);
  });
});
