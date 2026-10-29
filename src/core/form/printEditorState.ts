import { normalizePrintSettings, resolveTargetPrint } from '@/src/core/form/printSettings';
import { isSystemField } from '@/src/core/form/systemFields';
import type {
  FieldPrintSettings,
  FormDefinition,
  FormField,
  PrintGroup,
  PrintWhen,
  UrakkakorttiPrintSettings,
} from '@/src/core/form/types';

const PRINT_WHENS: readonly PrintWhen[] = ['always', 'notEmpty', 'ifYes'];
const PRINT_GROUPS: readonly PrintGroup[] = ['osa_alueet', 'tyovaiheet', 'muuta', 'tieto', 'maali'];

/** Yhden tulostuskohteen muokkaustila. `null` koko kohteena = pois päältä. */
export type TargetEditorState = {
  /** Puuttuu = sama kuin lomakkeen ylätason `when`. */
  when?: PrintWhen;
  group: PrintGroup;
  order?: number;
  label?: string;
  quantityKey?: string;
};

/**
 * Kenttäeditorin tulostustila.
 * `legacy` = kentällä ei ole print-objektia. Tällöin kohteet ovat P1:n efektiiviset oletukset,
 * mutta mitään ei kirjoiteta ennen kuin käyttäjä muuttaa asetusta.
 */
export type PrintEditorState = {
  legacy: boolean;
  when: PrintWhen;
  offer: TargetEditorState | null;
  urakkakortti: TargetEditorState | null;
};

export type QuantityKeyOption = {
  key: string;
  label: string;
};

function isPrintWhen(value: unknown): value is PrintWhen {
  return typeof value === 'string' && (PRINT_WHENS as readonly string[]).includes(value);
}

function isPrintGroup(value: unknown): value is PrintGroup {
  return typeof value === 'string' && (PRINT_GROUPS as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isExplicitPrint(field: FormField): field is FormField & { print: FieldPrintSettings } {
  return isPlainObject(field?.print);
}

/** P1: boolean → ifYes, muut → notEmpty. Ei ole exportattu printSettingsistä. */
function defaultWhen(field: FormField): PrintWhen {
  return field?.type === 'boolean' ? 'ifYes' : 'notEmpty';
}

/** ifYes ei ole kelvollinen muilla kuin Kyllä/Ei-kentillä (P1 käsittelee sen kuten notEmpty). */
function clampWhen(field: FormField, when: PrintWhen): PrintWhen {
  if (field?.type !== 'boolean' && when === 'ifYes') return defaultWhen(field);
  return when;
}

function targetFromResolved(
  resolved: { when: PrintWhen; group: PrintGroup; order?: number; label?: string; quantityKey?: string } | null,
  topWhen: PrintWhen,
): TargetEditorState | null {
  if (!resolved) return null;
  const state: TargetEditorState = { group: resolved.group };
  if (resolved.when !== topWhen) state.when = resolved.when;
  if (typeof resolved.order === 'number' && Number.isFinite(resolved.order)) state.order = resolved.order;
  if (typeof resolved.label === 'string') state.label = resolved.label;
  if (typeof resolved.quantityKey === 'string' && resolved.quantityKey.length > 0) {
    state.quantityKey = resolved.quantityKey;
  }
  return state;
}

/** Otsikko ja järjestelmäkenttä eivät tulostu, joten editoria ei näytetä. */
export function isPrintEditable(field: FormField): boolean {
  if (!field) return false;
  return field.type !== 'section' && !isSystemField(field);
}

export function printWhenOptions(field: FormField): PrintWhen[] {
  return field?.type === 'boolean' ? ['always', 'notEmpty', 'ifYes'] : ['always', 'notEmpty'];
}

/** P1 jättää €-rivit pois urakkakortilta. Tarkka yksikkövertailu, ei arvon €-merkkiä. */
export function canPrintOnUrakkakortti(field: FormField): boolean {
  return field?.unit !== '€';
}

/** Vain product_select. Muut ei-otsikkokentät (myös järjestelmäkentät, P1 hyväksyy niiden avaimen). */
export function quantityKeyOptions(form: FormDefinition, field: FormField): QuantityKeyOption[] {
  if (field?.type !== 'product_select') return [];
  const fields = Array.isArray(form?.fields) ? form.fields : [];
  return fields
    .filter(
      (item) =>
        item &&
        item.id !== field.id &&
        item.type !== 'section' &&
        typeof item.key === 'string' &&
        item.key.length > 0,
    )
    .map((item) => ({ key: item.key, label: item.label ?? item.key }));
}

export function readPrintEditorState(field: FormField, form: FormDefinition): PrintEditorState {
  const explicit = isExplicitPrint(field);
  const when = explicit && isPrintWhen(field.print.when) ? field.print.when : defaultWhen(field);
  return {
    legacy: !explicit,
    when,
    offer: targetFromResolved(resolveTargetPrint(field, 'offer', form), when),
    urakkakortti: targetFromResolved(resolveTargetPrint(field, 'urakkakortti', form), when),
  };
}

/**
 * Ensimmäinen muokkaus lähtee efektiivisestä legacy-tilasta (`legacy: false`), jotta write
 * tuottaa saman tulosteen. Esim. yhteenvetoon kuuluva boolean:
 * `{ offer: true, urakkakortti: { when: 'always' } }` kun kenttä ei ole € eikä asiakassivulla.
 */
export function legacyToExplicitState(field: FormField, form: FormDefinition): PrintEditorState {
  return { ...readPrintEditorState(field, form), legacy: false };
}

function rawTarget(value: unknown): TargetEditorState | null {
  if (value === true) return { group: 'tieto' };
  if (!isPlainObject(value)) return null;
  const group = isPrintGroup(value.group) ? value.group : 'tieto';
  const state: TargetEditorState = { group };
  // Eksplisiittinen ehto säilyy, vaikka se olisi sama kuin tämän tyypin oletus.
  // Muuten otsikon kautta kulkenut notEmpty katoaisi booleanin ifYes-oletukseen.
  if (isPrintWhen(value.when)) state.when = value.when;
  if (typeof value.order === 'number' && Number.isFinite(value.order)) state.order = value.order;
  if (typeof value.label === 'string') state.label = value.label;
  const quantityKey = value.quantityKey;
  if (typeof quantityKey === 'string' && quantityKey.length > 0) state.quantityKey = quantityKey;
  return state;
}

/** Kun resolveTargetPrint palauttaa null (otsikko / järjestelmäkenttä), luetaan print-objekti suoraan. */
function readRawPrintEditorState(field: FormField): PrintEditorState {
  const print = isExplicitPrint(field) ? field.print : undefined;
  const when = print && isPrintWhen(print.when) ? print.when : defaultWhen(field);
  return {
    legacy: !print,
    when,
    offer: rawTarget(print?.offer),
    urakkakortti: rawTarget(print?.urakkakortti),
  };
}

/**
 * Tyypinvaihdon lähtötila. Legacy (ei print-objektia) → null, print-avainta ei lisätä.
 * Ilman ylätason `when`-avainta ehto seuraa uuden tyypin oletusta.
 */
export function stateForTypeChange(
  current: FormField,
  nextField: FormField,
  form: FormDefinition,
): PrintEditorState | null {
  if (!isExplicitPrint(current)) return null;
  const state = isPrintEditable(current) ? readPrintEditorState(current, form) : readRawPrintEditorState(current);
  if (isPrintWhen(current.print.when)) return state;
  return { ...state, when: defaultWhen(nextField) };
}

function compactTarget(target: TargetEditorState | null, topWhen: PrintWhen, field: FormField): true | UrakkakorttiPrintSettings | undefined {
  if (!target) return undefined;
  const settings: UrakkakorttiPrintSettings = {};
  const when = target.when === undefined ? undefined : clampWhen(field, target.when);
  if (when && when !== topWhen) settings.when = when;
  if (target.group && target.group !== 'tieto') settings.group = target.group;
  if (typeof target.order === 'number' && Number.isFinite(target.order)) settings.order = target.order;
  if (typeof target.label === 'string') settings.label = target.label;
  if (typeof target.quantityKey === 'string' && target.quantityKey.length > 0) {
    settings.quantityKey = target.quantityKey;
  }
  return Object.keys(settings).length === 0 ? true : settings;
}

function collapseEmptyTargets(print: FieldPrintSettings): FieldPrintSettings {
  const next: FieldPrintSettings = {};
  if (print.when) next.when = print.when;
  if (print.offer !== undefined) {
    next.offer = print.offer === true || Object.keys(print.offer).length === 0 ? true : print.offer;
  }
  if (print.urakkakortti !== undefined) {
    next.urakkakortti =
      print.urakkakortti === true || Object.keys(print.urakkakortti).length === 0
        ? true
        : print.urakkakortti;
  }
  return next;
}

export function writePrintEditorState(
  state: PrintEditorState,
  field: FormField,
  form: FormDefinition,
): FieldPrintSettings {
  if (!state?.offer && !state?.urakkakortti) {
    return collapseEmptyTargets(normalizePrintSettings({}, field, form).print ?? {});
  }
  const top = clampWhen(field, state.when);
  const print: FieldPrintSettings = {};
  if (top !== defaultWhen(field)) print.when = top;
  const offer = compactTarget(state.offer, top, field);
  const urakkakortti = compactTarget(state.urakkakortti, top, field);
  if (offer !== undefined) print.offer = offer;
  if (urakkakortti !== undefined) print.urakkakortti = urakkakortti;
  return collapseEmptyTargets(normalizePrintSettings(print, field, form).print ?? {});
}

/** Ainoa paikka, jossa legacy-kentälle syntyy print-avain. */
export function applyPrintEditorChange(
  field: FormField,
  form: FormDefinition,
  nextState: PrintEditorState,
): FormField {
  return { ...field, print: writePrintEditorState(nextState, field, form) };
}
