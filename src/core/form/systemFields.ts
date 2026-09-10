import type { FormField } from '@/src/core/form/types';
import { displayWorkDurationText } from '@/src/core/utils/formatters';

export type SystemFieldKey =
  | 'tyoryhma_kesto_pv'
  | 'tyoryhma_kesto_h'
  | 'alennus_prosentti'
  | 'alennus_eur'
  | 'urakka_hinta_alv0'
  | 'materiaalit'
  | 'myyntikate_eur'
  | 'myyntipalkkio_eur'
  | 'kokonaishinta_alv0'
  | 'alv_maara'
  | 'kokonaishinta';

/**
 * Automaattinen kaavamuuttuja (ei FormField / Kentät-UI).
 * Alkaa nollasta; putki täyttää tuoteriveistä + materiaaliefekteistä.
 */
export const MATERIALS_CONTEXT_KEY = 'materiaalit';

/** Putken varaamat avaimet – ei käyttäjäkenttien nimiä. */
export const PIPELINE_CONTEXT_KEYS: ReadonlySet<string> = new Set([MATERIALS_CONTEXT_KEY]);

/**
 * Rungon rivit, joita ei näytetä lomakkeella / Kentät-listassa.
 * Urakka, materiaalit, palkkio ja kokonaishinnat saa laittaa sivulle ja yliajaa.
 */
export const UI_HIDDEN_SYSTEM_FIELD_KEYS: ReadonlySet<SystemFieldKey> = new Set([
  'myyntikate_eur',
  'alv_maara',
  'alennus_eur',
]);

/** Runko laskee nämä aina itse kokonaishinta_alv0:sta. JSON-kaavaa ei säilytetä. */
export const APP_OWNED_FORMULA_KEYS: ReadonlySet<SystemFieldKey> = new Set([
  'alv_maara',
  'kokonaishinta',
]);

/** Poistetut järjestelmäkentät (migraatio sivuilta / vanhoista pohjista). */
export const REMOVED_SYSTEM_FIELD_IDS: ReadonlySet<string> = new Set();

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
 * Oletusvienti: tehdaslomake täyttää avaimet näillä kaavoilla.
 * JSON saa korvata muut paitsi alv_maara ja kokonaishinta.
 */
export function createSystemFields(): FormField[] {
  return [
    baseSystemField(
      'field_system_tyoryhma_kesto_pv',
      'tyoryhma_kesto_pv',
      'tyoryhma_kesto_pv',
      'Työn kesto (pv)',
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
      'Työn kesto (h)',
      'tyoryhma_kesto_pv * asetukset.tyopaivan_pituus',
      'h',
    ),
    baseSystemField(
      'field_system_alennus_prosentti',
      'alennus_prosentti',
      'alennus_prosentti',
      'Alennus',
      '',
      '%',
      {
        type: 'number',
        required: false,
        allowManualOverride: true,
        defaultValue: '0',
        debugExampleValue: '0',
        helpText: 'Kaupallinen alennus myyntihinnasta (0–100 %). Tyhjä = ei alennusta.',
      },
    ),
    baseSystemField(
      'field_system_alennus_eur',
      'alennus_eur',
      'alennus_eur',
      'Alennus (€)',
      'kokonaishinta_alv0 * min(100, max(0, alennus_prosentti)) / 100',
      '€',
    ),
    baseSystemField(
      'field_system_urakka',
      'urakka_hinta_alv0',
      'urakka_hinta_alv0',
      'Urakkahinta (alv0)',
      'tyoryhma_kesto_h * asetukset.tyoryhman_koko * asetukset.tuntihinta',
      '€',
      { allowManualOverride: true },
    ),
    baseSystemField(
      'field_system_materiaalit',
      'materiaalit',
      MATERIALS_CONTEXT_KEY,
      'Materiaalit (alv0)',
      '',
      '€',
      {
        allowManualOverride: true,
        helpText: 'Summa tuoteriveistä ja materiaaliefekteistä. Voit yliajaa arvon lomakkeella.',
      },
    ),
    baseSystemField(
      'field_system_kokonaishinta_alv0',
      'kokonaishinta_alv0',
      'kokonaishinta_alv0',
      'Myyntihinta (alv0)',
      `(urakka_hinta_alv0 + ${MATERIALS_CONTEXT_KEY}) / (1 - asetukset.myyntikate_prosentti/100 - asetukset.myyntipalkkio_prosentti/100) / (1 + asetukset.alv_prosentti/100)`,
      '€',
      { allowManualOverride: true },
    ),
    baseSystemField(
      'field_system_kokonaishinta',
      'kokonaishinta',
      'kokonaishinta',
      'Kokonaishinta (alv)',
      'kokonaishinta_alv0 + alv_maara',
      '€',
      { allowManualOverride: true },
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
      { allowManualOverride: true },
    ),
    baseSystemField(
      'field_system_alv',
      'alv_maara',
      'alv_maara',
      'ALV (€)',
      'kokonaishinta_alv0 * asetukset.alv_prosentti / 100',
      '€',
    ),
  ];
}

export function isSystemField(field: FormField): boolean {
  return field.systemKey !== undefined;
}

export function isSystemFieldHiddenFromUi(field: Pick<FormField, 'systemKey'>): boolean {
  return (
    field.systemKey !== undefined &&
    UI_HIDDEN_SYSTEM_FIELD_KEYS.has(field.systemKey as SystemFieldKey)
  );
}

export function isAppOwnedFormulaField(field: Pick<FormField, 'systemKey'>): boolean {
  return (
    field.systemKey !== undefined &&
    APP_OWNED_FORMULA_KEYS.has(field.systemKey as SystemFieldKey)
  );
}

export function isMaterialsSystemField(field: Pick<FormField, 'systemKey' | 'key'>): boolean {
  return field.systemKey === 'materiaalit' || field.key === MATERIALS_CONTEXT_KEY;
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
  const reservedKeys = new Set([
    ...systemDefaults.map((field) => field.key),
    ...PIPELINE_CONTEXT_KEYS,
  ]);
  const userFields = fields.filter((field) => !isSystemField(field) && !reservedKeys.has(field.key));
  const existingSystem = fields.filter(
    (field) => isSystemField(field) && !REMOVED_SYSTEM_FIELD_IDS.has(field.id),
  );
  const promoted = fields.filter(
    (field) =>
      !isSystemField(field) &&
      reservedKeys.has(field.key) &&
      !PIPELINE_CONTEXT_KEYS.has(field.key),
  );
  const mergedSystem = systemDefaults.map((template) => {
    const current =
      existingSystem.find((field) => field.systemKey === template.systemKey) ??
      promoted.find((field) => field.key === template.key);
    if (!current) return template;
    const ownedFormula =
      isAppOwnedFormulaField(template) || template.systemKey === 'materiaalit';
    const importedFormula = current.formula?.trim();
    return {
      ...template,
      id: current.systemKey ? current.id : template.id,
      label: displayWorkDurationText(current.label || template.label),
      formula: ownedFormula
        ? template.formula
        : migrateFormulaKeys(current.formula ?? template.formula ?? ''),
      showOnSummary: isSystemFieldHiddenFromUi(template) ? false : current.showOnSummary,
      helpText: current.helpText ?? (importedFormula ? undefined : template.helpText),
      unit: current.unit ?? template.unit,
      allowManualOverride: template.allowManualOverride,
      debugExampleValue:
        current.debugExampleValue ?? (importedFormula ? undefined : template.debugExampleValue),
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
  materiaalirivit_yhteensa: MATERIALS_CONTEXT_KEY,
  materiaalit_alv0: MATERIALS_CONTEXT_KEY,
  'settings.vat_percent': 'asetukset.alv_prosentti',
  'settings.default_margin_percent': 'asetukset.myyntikate_prosentti',
  'settings.default_commission_percent': 'asetukset.myyntipalkkio_prosentti',
  'settings.default_hourly_rate': 'asetukset.tuntihinta',
  'settings.default_crew_size': 'asetukset.tyoryhman_koko',
  'settings.workday_hours': 'asetukset.tyopaivan_pituus',
  muu_tyo_tyoparin_kesto_h: 'muu_tyo_kesto_h',
};

/** Työparitunnit → henkilötunnit (muun työn kesto). */
const LEGACY_MUU_TYO_PAIR_HOURS =
  'if(muu_tyo_kesto_h > 0, muu_tyo_kesto_h * 2, 0)';

export function migrateFormulaKeys(formula: string): string {
  if (!formula) return formula;
  let result = formula;
  const entries = Object.entries(LEGACY_KEY_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [legacy, next] of entries) {
    result = result.replaceAll(legacy, next);
  }
  return result.replaceAll(LEGACY_MUU_TYO_PAIR_HOURS, 'muu_tyo_kesto_h');
}

/** Vanhat syöteavaimet, jotka vastaavat nykyistä kentän avainta. */
export function legacyKeysForCurrentKey(currentKey: string): string[] {
  return Object.entries(LEGACY_KEY_MAP)
    .filter(([legacy, current]) => current === currentKey && !legacy.includes('.'))
    .map(([legacy]) => legacy);
}
