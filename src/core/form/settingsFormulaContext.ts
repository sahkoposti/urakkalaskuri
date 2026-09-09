import type { AppSettings } from '@/src/core/models/types';

const SETTING_BINDINGS: Array<{ finnish: string; legacy: string; value: (s: AppSettings) => number }> = [
  { finnish: 'asetukset.alv_prosentti', legacy: 'settings.vat_percent', value: (s) => s.vatPercent },
  {
    finnish: 'asetukset.myyntikate_prosentti',
    legacy: 'settings.default_margin_percent',
    value: (s) => s.defaultMarginPercent,
  },
  {
    finnish: 'asetukset.myyntikate_alaraja_eur',
    legacy: 'settings.margin_low_amount',
    value: (s) => s.marginLowAmount,
  },
  {
    finnish: 'asetukset.myyntikate_alaraja_prosentti',
    legacy: 'settings.margin_low_percent',
    value: (s) => s.marginLowPercent,
  },
  {
    finnish: 'asetukset.myyntikate_ylaraja_eur',
    legacy: 'settings.margin_high_amount',
    value: (s) => s.marginHighAmount,
  },
  {
    finnish: 'asetukset.myyntikate_ylaraja_prosentti',
    legacy: 'settings.margin_high_percent',
    value: (s) => s.marginHighPercent,
  },
  {
    finnish: 'asetukset.myyntipalkkio_prosentti',
    legacy: 'settings.default_commission_percent',
    value: (s) => s.defaultCommissionPercent,
  },
  {
    finnish: 'asetukset.tuntihinta',
    legacy: 'settings.default_hourly_rate',
    value: (s) => s.defaultHourlyRate,
  },
  {
    finnish: 'asetukset.tyoryhman_koko',
    legacy: 'settings.default_crew_size',
    value: (s) => s.defaultCrewSize,
  },
  {
    finnish: 'asetukset.tyopaivan_pituus',
    legacy: 'settings.workday_hours',
    value: (s) => s.workdayHours,
  },
];

/** Muuttujat kaavoissa: asetukset.tyopaivan_pituus jne. (+ legacy settings.* alias). */
export function buildSettingsFormulaContext(settings: AppSettings): Record<string, number> {
  const context: Record<string, number> = {};
  for (const binding of SETTING_BINDINGS) {
    const value = binding.value(settings);
    context[binding.finnish] = value;
    context[binding.legacy] = value;
  }
  return context;
}
