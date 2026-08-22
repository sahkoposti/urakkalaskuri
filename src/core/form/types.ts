export type FieldType =
  | 'number'
  | 'text'
  | 'select'
  | 'boolean'
  | 'product_quantity'
  | 'product_select'
  | 'computed'
  | 'section';

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  number: 'Numero',
  text: 'Teksti',
  select: 'Valinta',
  boolean: 'Kyllä/Ei',
  product_quantity: 'Tuote + määrä',
  product_select: 'Tuotevalinta',
  computed: 'Laskettu',
  section: 'Otsikko',
};

export const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

/** v1-yhteensopiva kestokenttä: päivät → tunnit pipelineessa */
export const DURATION_DAYS_KEY = 'työryhmän_kesto_pv';

export interface SelectOption {
  label: string;
  value: string;
  multiplier?: number;
  workFactor?: number;
  materialFactor?: number;
  /** Kirjoittaa arvon kontekstiin tällä avaimella (esim. laudoituskerroin) */
  exportKey?: string;
  exportValue?: number;
}

export type FieldEffectType =
  | 'set_variable'
  | 'add_material'
  | 'multiply_duration'
  | 'add_duration'
  | 'multiply_materials'
  | 'add_material_fixed';

export const FIELD_EFFECT_LABELS: Record<FieldEffectType, string> = {
  set_variable: 'Tallenna muuttuja',
  add_material: 'Lisää materiaalirivi',
  multiply_duration: 'Kerro kesto',
  add_duration: 'Lisää kesto (h)',
  multiply_materials: 'Kerro materiaalit',
  add_material_fixed: 'Kiinteä materiaalilisä (€)',
};

export const EDITABLE_EFFECT_TYPES: FieldEffectType[] = [
  'add_material',
  'multiply_duration',
  'add_duration',
  'multiply_materials',
  'add_material_fixed',
];

export interface FieldEffect {
  type: FieldEffectType;
  /** product_select -kentän key tai tuote-id */
  productRef?: string;
  /** Kentän key, josta määrä luetaan */
  quantityRef?: string;
  /** Kentän key määrälle (kesto-h tai €) */
  amountRef?: string;
  /** Kentän key kertoimelle */
  factorRef?: string;
  amount?: number;
  factor?: number;
}

export interface FormField {
  id: string;
  pageId: string;
  key: string;
  label: string;
  type: FieldType;
  sortOrder: number;
  required: boolean;
  showOnSummary: boolean;
  unit?: string;
  options?: SelectOption[];
  formula?: string;
  effects?: FieldEffect[];
  helpText?: string;
  /** Kiinteä tuote product_quantity -kentälle */
  productId?: string;
  /** Debug-tilassa käytettävä esimerkkiarvo (merkkijonona, parsitaan tyypin mukaan) */
  debugExampleValue?: string;
}

export interface FormPage {
  id: string;
  title: string;
  sortOrder: number;
  system?: 'customer' | 'materials';
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
}

export const defaultFormDebugSettings: FormDebugSettings = {
  enabled: false,
  showIntermediateSteps: true,
};

export const PRODUCT_ATTRIBUTE_KEYS = [
  'unit_price',
  'consumption',
  'purchase_price',
  'sale_price',
  'work_factor',
  'material_factor',
] as const;

export type ProductAttributeKey = (typeof PRODUCT_ATTRIBUTE_KEYS)[number];

export interface ProductQuantityValue {
  productId: string;
  quantity: number;
}

export type FieldValue = string | number | boolean | ProductQuantityValue | null | undefined;
