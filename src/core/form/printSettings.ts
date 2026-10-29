import { isSystemField } from '@/src/core/form/systemFields';
import type {
  FieldPrintSettings,
  FormDefinition,
  FormField,
  PrintGroup,
  PrintTargetSettings,
  PrintWhen,
  UrakkakorttiPrintSettings,
} from '@/src/core/form/types';

const PRINT_WHENS: readonly PrintWhen[] = ['always', 'notEmpty', 'ifYes'];
const PRINT_GROUPS: readonly PrintGroup[] = ['osa_alueet', 'tyovaiheet', 'muuta', 'tieto', 'maali'];

/** Ratkaistu tulostus yhteen kohteeseen. `legacy` = kentällä ei ole print-objektia. */
export type ResolvedPrint = {
  when: PrintWhen;
  group: PrintGroup;
  order?: number;
  label?: string;
  quantityKey?: string;
  legacy: boolean;
};

type PrintNormalizeResult = { print?: FieldPrintSettings; warnings: string[] };

function fieldKey(field: FormField | null | undefined): string {
  return field && typeof field.key === 'string' && field.key ? field.key : '?';
}

function fieldWarning(field: FormField | null | undefined, message: string): string {
  return `Kenttä "${fieldKey(field)}": ${message}`;
}

function shown(value: unknown): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NaN';
  if (typeof value === 'boolean' || value === null) return String(value);
  if (Array.isArray(value)) return 'taulukko';
  if (typeof value === 'object') return 'objekti';
  return typeof value;
}

function isPrintWhen(value: unknown): value is PrintWhen {
  return typeof value === 'string' && (PRINT_WHENS as readonly string[]).includes(value);
}

function isPrintGroup(value: unknown): value is PrintGroup {
  return typeof value === 'string' && (PRINT_GROUPS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function catalogFields(form: { fields: FormField[] } | null | undefined): FormField[] {
  return Array.isArray(form?.fields) ? form.fields : [];
}

function isValidQuantityKey(
  value: unknown,
  field: FormField,
  group: PrintGroup | undefined,
  form: { fields: FormField[] } | null | undefined,
): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (field?.type !== 'product_select') return false;
  if ((group ?? 'tieto') !== 'maali') return false;
  return catalogFields(form).some((item) => item?.key === value);
}

function readTarget(
  raw: unknown,
  field: FormField,
  target: 'offer' | 'urakkakortti',
  form: { fields: FormField[] },
  warnings: string[],
): true | PrintTargetSettings | UrakkakorttiPrintSettings | undefined {
  if (raw === true) return true;
  if (!isPlainObject(raw)) {
    warnings.push(fieldWarning(field, `print.${target} ei ole true tai objekti, ohitettu`));
    return undefined;
  }

  const settings: UrakkakorttiPrintSettings = {};

  if ('when' in raw) {
    if (isPrintWhen(raw.when)) settings.when = raw.when;
    else warnings.push(fieldWarning(field, `tuntematon print.${target}.when ${shown(raw.when)} ohitettu`));
  }

  if ('group' in raw) {
    if (isPrintGroup(raw.group)) settings.group = raw.group;
    else {
      settings.group = 'tieto';
      warnings.push(fieldWarning(field, `tuntematon print.${target}.group ${shown(raw.group)} ohitettu`));
    }
  }

  if ('order' in raw) {
    if (typeof raw.order === 'number' && Number.isFinite(raw.order)) settings.order = raw.order;
    else warnings.push(fieldWarning(field, `virheellinen print.${target}.order ${shown(raw.order)} ohitettu`));
  }

  if ('label' in raw) {
    if (typeof raw.label === 'string') settings.label = raw.label;
    else warnings.push(fieldWarning(field, `virheellinen print.${target}.label ${shown(raw.label)} ohitettu`));
  }

  if ('quantityKey' in raw) {
    if (target !== 'urakkakortti') {
      warnings.push(fieldWarning(field, `print.${target}.quantityKey ei ole sallittu, ohitettu`));
    } else if (!isValidQuantityKey(raw.quantityKey, field, settings.group, form)) {
      warnings.push(
        fieldWarning(field, `virheellinen print.urakkakortti.quantityKey ${shown(raw.quantityKey)} ohitettu`),
      );
    } else {
      settings.quantityKey = raw.quantityKey;
    }
  }

  for (const key of Object.keys(raw)) {
    if (key === 'when' || key === 'group' || key === 'order' || key === 'label' || key === 'quantityKey') continue;
    warnings.push(fieldWarning(field, `tuntematon print.${target}.${key} ohitettu`));
  }

  return settings;
}

function normalizePrintSettingsInner(
  raw: unknown,
  field: FormField,
  form: { fields: FormField[] },
): PrintNormalizeResult {
  // Puuttuva arvo = vanha oletus, ei huomiota. null / merkkijono / taulukko / luku = virhe.
  if (raw === undefined) return { warnings: [] };
  if (!isPlainObject(raw)) {
    return { warnings: [fieldWarning(field, 'print ei ole objekti, ohitettu')] };
  }

  const warnings: string[] = [];
  const print: FieldPrintSettings = {};

  if ('when' in raw) {
    if (isPrintWhen(raw.when)) print.when = raw.when;
    else warnings.push(fieldWarning(field, `tuntematon print.when ${shown(raw.when)} ohitettu`));
  }

  for (const key of Object.keys(raw)) {
    if (key === 'when' || key === 'offer' || key === 'urakkakortti') continue;
    warnings.push(fieldWarning(field, `tuntematon tulostuskohde "${key}" ohitettu`));
  }

  if ('offer' in raw) {
    const offer = readTarget(raw.offer, field, 'offer', form, warnings);
    if (offer !== undefined) print.offer = offer;
  }

  if ('urakkakortti' in raw) {
    const urakkakortti = readTarget(raw.urakkakortti, field, 'urakkakortti', form, warnings);
    if (urakkakortti !== undefined) print.urakkakortti = urakkakortti;
  }

  return { print, warnings };
}

/**
 * Siivoaa kentän print-lohkon. Idempotentti, ei heitä.
 * Kelvoton koko arvo (ei objekti, paitsi puuttuva undefined) → ei printiä (vanha oletus) ja yksi huomio.
 */
export function normalizePrintSettings(
  raw: unknown,
  field: FormField,
  form: { fields: FormField[] },
): PrintNormalizeResult {
  try {
    return normalizePrintSettingsInner(raw, field, form);
  } catch {
    return { warnings: [fieldWarning(field, 'print-asetusta ei voitu lukea, ohitettu')] };
  }
}

function defaultWhen(field: FormField): PrintWhen {
  return field.type === 'boolean' ? 'ifYes' : 'notEmpty';
}

function asWhen(value: unknown, fallback: PrintWhen): PrintWhen {
  return isPrintWhen(value) ? value : fallback;
}

function asGroup(value: unknown): PrintGroup {
  return isPrintGroup(value) ? value : 'tieto';
}

function explicitPrint(field: FormField): FieldPrintSettings | null {
  const print = field.print as unknown;
  if (!isPlainObject(print)) return null;
  return print as FieldPrintSettings;
}

/** Ensimmäinen sivu, jolla kenttä on. Urakkakortin vanha sääntö: system === 'customer' ei tulostu. */
function onCustomerPage(field: FormField, form: FormDefinition): boolean {
  const pages = [...(form.pages ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const page of pages) {
    if ((page.fieldIds ?? []).includes(field.id)) return page.system === 'customer';
  }
  return false;
}

function legacyResolved(field: FormField, target: 'offer' | 'urakkakortti', form: FormDefinition): ResolvedPrint | null {
  if (!field.showOnSummary) return null;
  if (field.unit === '€') return null;
  if (target === 'urakkakortti' && onCustomerPage(field, form)) return null;
  return {
    when: target === 'urakkakortti' && field.type === 'boolean' ? 'always' : defaultWhen(field),
    group: 'tieto',
    legacy: true,
  };
}

function resolvedFromExplicit(
  field: FormField,
  target: 'offer' | 'urakkakortti',
  print: FieldPrintSettings,
  form: FormDefinition,
): ResolvedPrint | null {
  const targetValue = print[target];
  if (targetValue == null) return null;
  if (targetValue !== true && !isPlainObject(targetValue)) return null;
  const settings = targetValue === true ? {} : targetValue;
  const group = asGroup(settings.group);
  const resolved: ResolvedPrint = {
    when: asWhen(settings.when, asWhen(print.when, defaultWhen(field))),
    group,
    legacy: false,
  };
  if (typeof settings.order === 'number' && Number.isFinite(settings.order)) resolved.order = settings.order;
  if (typeof settings.label === 'string') resolved.label = settings.label;
  if (
    target === 'urakkakortti' &&
    isValidQuantityKey((settings as UrakkakorttiPrintSettings).quantityKey, field, group, form)
  ) {
    resolved.quantityKey = (settings as UrakkakorttiPrintSettings).quantityKey;
  }
  return resolved;
}

/**
 * Kohteen tulostusasetus. Puuttuva tai ei-objekti `print` → vanha oletus.
 * `section` ja järjestelmäkenttä → null (eivät tulostu printin kautta).
 */
export function resolveTargetPrint(
  field: FormField,
  target: 'offer' | 'urakkakortti',
  form: FormDefinition,
): ResolvedPrint | null {
  try {
    if (!field || field.type === 'section' || isSystemField(field)) return null;
    const print = explicitPrint(field);
    if (!print) return legacyResolved(field, target, form);
    return resolvedFromExplicit(field, target, print, form);
  } catch {
    return null;
  }
}

/**
 * Täyttääkö arvo when-säännön.
 * always: boolean Kyllä ja Ei, numero myös 0, tyhjä teksti ei.
 * notEmpty: teksti ei tyhjä, numero ≠ 0, valinta tai tuote valittu; boolean = always.
 * ifYes: boolean vain true; muut = notEmpty.
 * Puuttuva numero ei ole 0.
 */
export function passesPrintWhen(
  when: PrintWhen,
  field: FormField,
  rawValue: string | undefined,
  num: number | undefined,
): boolean {
  try {
    const effective: PrintWhen = isPrintWhen(when) ? when : 'notEmpty';
    const type = field?.type;

    if (type === 'boolean') {
      if (effective === 'ifYes') return rawValue === 'true';
      return true;
    }

    if (type === 'number' || type === 'computed') {
      if (typeof num !== 'number' || !Number.isFinite(num)) return false;
      if (effective === 'always') return true;
      return num !== 0;
    }

    if (type === 'text' || type === 'select' || type === 'product_select') {
      return typeof rawValue === 'string' && rawValue.trim() !== '';
    }

    return false;
  } catch {
    return false;
  }
}
