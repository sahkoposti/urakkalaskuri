export type FieldType =
  | 'number'
  | 'text'
  | 'select'
  | 'boolean'
  | 'product_select'
  | 'computed'
  | 'section';

export interface SelectOption {
  label: string;
  /** Numeerinen arvo kaavoissa (merkkijonona, esim. "1.15") */
  value: string;
}

export interface FieldEffect {
  type:
    | 'set_variable'
    | 'add_material' // legacy, ohitetaan
    | 'multiply_duration'
    | 'add_duration'
    | 'multiply_materials'
    | 'add_material_fixed';
  productRef?: string;
  /** Kiinteä arvo vaikutukselle: € (materiaalilisä), h (kestolisä) tai kerroin. */
  value?: number;
  /** @deprecated Käytä value-kenttää. Luetaan vielä laskennassa vanhoista lomakkeista. */
  quantityRef?: string;
}

/** Näkyvyysehto: näytä kenttä jos toisen kentän arvo täyttää vertailun. */
export type FieldVisibilityOperator = 'eq' | 'neq';

export interface FieldVisibilityCondition {
  /** Riippuvan kentän muuttuja (key), esim. raystaan_aluset */
  fieldKey: string;
  /** Vertailuoperaattori (oletus eq) */
  operator?: FieldVisibilityOperator;
  /**
   * Odotettu raaka-arvo:
   * - boolean: "true" | "false"
   * - select: option.value (esim. "1.15")
   */
  value: string;
}

export interface FormField {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  showOnSummary: boolean;
  /** Laskettu kenttä lomakkeella: näytetään muokattavana arvona (oletus true) */
  allowManualOverride?: boolean;
  unit?: string;
  options?: SelectOption[];
  formula?: string;
  effects?: FieldEffect[];
  /** Näytä kenttä vain kun ehto täyttyy; puuttuu = aina näkyvissä */
  showWhen?: FieldVisibilityCondition;
  helpText?: string;
  /** Debug-tilassa käytettävä esimerkkiarvo (merkkijonona, parsitaan tyypin mukaan) */
  debugExampleValue?: string;
  /** Järjestelmäkenttä (hinta, kesto…) – kaavaa ei voi poistaa */
  systemKey?: string;
}

export interface FormPage {
  id: string;
  title: string;
  sortOrder: number;
  system?: 'customer' | 'materials';
  /** Tällä sivulla näytettävät globaalit kentät järjestyksessä */
  fieldIds: string[];
}

export interface FormDefinition {
  id: string;
  name: string;
  version: number;
  pages: FormPage[];
  fields: FormField[];
  updatedAt: number;
}

export interface FormDebugSettings {
  enabled: boolean;
  showIntermediateSteps: boolean;
  /** Debug-laskennan oletusmateriaalit (alv0) järjestelmäkaavoille */
  materialsVat0?: number;
}

export const defaultFormDebugSettings: FormDebugSettings = {
  enabled: false,
  showIntermediateSteps: true,
  materialsVat0: 250,
};
