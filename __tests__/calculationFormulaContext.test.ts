import {
  buildCalculationFormulaContext,
  CALCULATION_TRAVEL_TIME_HOURS_KEY,
  formatTravelTimeHoursOneWay,
  parseTravelTimeHoursOneWay,
} from '../src/core/form/calculationFormulaContext';
import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { unknownFormulaIdentifiers, normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { runProductionPipeline } from '../src/core/calculation/calculationPipeline';
import { defaultSettings } from '../src/core/models/types';

describe('travel time one way', () => {
  test('parses Finnish decimal hours', () => {
    expect(parseTravelTimeHoursOneWay('0,75')).toBeCloseTo(0.75, 5);
    expect(parseTravelTimeHoursOneWay('1.5')).toBeCloseTo(1.5, 5);
    expect(parseTravelTimeHoursOneWay('')).toBe(0);
    expect(parseTravelTimeHoursOneWay(-2)).toBe(0);
  });

  test('formats hours for the composer field', () => {
    expect(formatTravelTimeHoursOneWay(0.75)).toBe('0,75');
    expect(formatTravelTimeHoursOneWay(undefined)).toBe('');
  });

  test('exposes laskelma.matka_aika_h to formulas', () => {
    const form = normalizeFormDefinition(createMinimalFormDefinition());
    form.fields.push({
      id: 'field_matka_yhteensa',
      key: 'matka_henkilotyotunnit',
      label: 'Matka-aika yhteensä',
      type: 'computed',
      required: false,
      showOnSummary: true,
      formula: 'laskelma.matka_aika_h * 2 * tyoryhma_kesto_pv * asetukset.tyoryhman_koko',
    });
    const context = runProductionPipeline(
      form,
      { tyoryhma_kesto_pv: '5' },
      0,
      defaultSettings,
      [],
      { extraContext: buildCalculationFormulaContext({ travelTimeHoursOneWay: 0.75 }) },
    );
    expect(context[CALCULATION_TRAVEL_TIME_HOURS_KEY]).toBeCloseTo(0.75, 5);
    expect(context.matka_henkilotyotunnit).toBeCloseTo(0.75 * 2 * 5 * defaultSettings.defaultCrewSize, 5);
  });

  test('unknownFormulaIdentifiers allows laskelma.matka_aika_h', () => {
    const form = normalizeFormDefinition(createMinimalFormDefinition());
    expect(unknownFormulaIdentifiers(form, 'laskelma.matka_aika_h * 2')).toEqual([]);
  });
});
