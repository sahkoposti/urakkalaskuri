import type { FormField } from '@/src/core/form/types';

export type SystemFieldKey =
  | 'tyoryhma_kesto_pv'
  | 'tyoryhma_kesto_h'
  | 'urakka_hinta_alv0'
  | 'materiaalit_alv0'
  | 'myyntikate_eur'
  | 'myyntipalkkio_eur'
  | 'kokonaishinta_alv0'
  | 'alv_maara'
  | 'kokonaishinta';

const baseSystemField = (
  id: string,
  systemKey: SystemFieldKey,
  key: string,
  label: string,
  formula: string,
  unit?: string,
  extras: Partial<FormField> = {},
): FormField => ({
  id,
  systemKey,
  key,
  label,
  type: 'computed',
  required: false,
  showOnSummary: true,
  allowManualOverride: false,
  unit,
  formula,
  ...extras,
});

/**
 * Järjestelmäkaavat ovat wizardin ja debugin yhteinen hintalähde.
 * runFormCalculation rakentaa CalculationResult näistä avaimista.
 */
export function createSystemFields(): FormField[] {
  return [
    baseSystemField(
      'field_system_tyoryhma_kesto_pv',
      'tyoryhma_kesto_pv',
      'tyoryhma_kesto_pv',
      'Työryhmän kesto (pv)',
      '',
      'pv',
      {
        allowManualOverride: true,
        debugExampleValue: '5',
        helpText:
          'Laske päivät mitoista (esim. laskenta_seinapinta_ala_m2 / 25) tai jätä kaava tyhjäksi ja syötä päivät lomakkeella.',
      },
    ),
    baseSystemField(
      'field_system_tyoryhma_kesto_h',
      'tyoryhma_kesto_h',
      'tyoryhma_kesto_h',
      'Työryhmän kesto (h)',
      'tyoryhma_kesto_pv * asetukset.tyopaivan_pituus',
      'h',
    ),
    baseSystemField(
      'field_system_urakka',
      'urakka_hinta_alv0',
      'urakka_hinta_alv0',
      'Urakkahinta (alv0)',
      'tyoryhma_kesto_h * asetukset.tyoryhman_koko * asetukset.tuntihinta',
      '€',
    ),
    baseSystemField(
      'field_system_materiaalit',
      'materiaalit_alv0',
      'materiaalit_alv0',
      'Materiaalit yhteensä (alv0)',
      'materiaalirivit_yhteensa',
      '€',
    ),
    baseSystemField(
      'field_system_kokonaishinta',
      'kokonaishinta',
      'kokonaishinta',
      'Kokonaishinta (alv)',
      '(urakka_hinta_alv0 + materiaalit_alv0) / (1 - asetukset.myyntikate_prosentti/100 - asetukset.myyntipalkkio_prosentti/100)',
      '€',
    ),
    baseSystemField(
      'field_system_kokonaishinta_alv0',
      'kokonaishinta_alv0',
      'kokonaishinta_alv0',
      'Myyntihinta (alv0)',
      'kokonaishinta / (1 + asetukset.alv_prosentti/100)',
      '€',
    ),
    baseSystemField(
      'field_system_myyntikate',
      'myyntikate_eur',
      'myyntikate',
      'Myyntikate (€)',
      'kokonaishinta * asetukset.myyntikate_prosentti/100',
      '€',
    ),
    baseSystemField(
      'field_system_myyntipalkkio',
      'myyntipalkkio_eur',
      'myyntipalkkio',
      'Myyntipalkkio (€)',
      'kokonaishinta * asetukset.myyntipalkkio_prosentti/100',
      '€',
    ),
    baseSystemField(
      'field_system_alv',
      'alv_maara',
      'alv_maara',
      'ALV (€)',
      'kokonaishinta - kokonaishinta_alv0',
      '€',
    ),
  ];
}

export function isSystemField(field: FormField): boolean {
  return field.systemKey !== undefined;
}

export function getDefaultSystemField(systemKey: SystemFieldKey): FormField | undefined {
  return createSystemFields().find((field) => field.systemKey === systemKey);
}

/** Palauttaa järjestelmäkentän oletuskaavan, -nimen ja -asetukset. */
export function restoreSystemField(field: FormField): FormField {
  if (!field.systemKey) return field;
  const template = getDefaultSystemField(field.systemKey as SystemFieldKey);
  if (!template) return field;
  return { ...template, id: field.id };
}

export function mergeSystemFields(fields: FormField[]): FormField[] {
  const systemDefaults = createSystemFields();
  const reservedKeys = new Set(systemDefaults.map((field) => field.key));
  const userFields = fields.filter((field) => !isSystemField(field) && !reservedKeys.has(field.key));
  const existingSystem = fields.filter(isSystemField);
  const promoted = fields.filter((field) => !isSystemField(field) && reservedKeys.has(field.key));
  const mergedSystem = systemDefaults.map((template) => {
    const current =
      existingSystem.find((field) => field.systemKey === template.systemKey) ??
      promoted.find((field) => field.key === template.key);
    if (!current) return template;
    return {
      ...template,
      id: current.systemKey ? current.id : template.id,
      label: current.label || template.label,
      formula: migrateFormulaKeys(current.formula ?? template.formula ?? ''),
      showOnSummary: current.showOnSummary,
      helpText: current.helpText ?? template.helpText,
      unit: current.unit ?? template.unit,
      allowManualOverride: current.allowManualOverride ?? template.allowManualOverride,
      debugExampleValue: current.debugExampleValue ?? template.debugExampleValue,
    };
  });
  return [...userFields, ...mergedSystem];
}

/** Vanhojen avainten migraatio ASCII- ja suomenkielisiin muotoihin */
export const LEGACY_KEY_MAP: Record<string, string> = {
  kiinteä_seinäpinta_ala_m2: 'kiintea_seinapinta_ala_m2',
  laskenta_seinäpinta_ala_m2: 'laskenta_seinapinta_ala_m2',
  työryhmän_kesto_pv: 'tyoryhma_kesto_pv',
  aukkovähennykset: 'aukkovahennykset',
  myyntikate_eur: 'myyntikate',
  myyntipalkkio_eur: 'myyntipalkkio',
  'settings.vat_percent': 'asetukset.alv_prosentti',
  'settings.default_margin_percent': 'asetukset.myyntikate_prosentti',
  'settings.default_commission_percent': 'asetukset.myyntipalkkio_prosentti',
  'settings.default_hourly_rate': 'asetukset.tuntihinta',
  'settings.default_crew_size': 'asetukset.tyoryhman_koko',
  'settings.workday_hours': 'asetukset.tyopaivan_pituus',
};

export function migrateFormulaKeys(formula: string): string {
  if (!formula) return formula;
  let result = formula;
  const entries = Object.entries(LEGACY_KEY_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [legacy, next] of entries) {
    result = result.replaceAll(legacy, next);
  }
  return result;
}
