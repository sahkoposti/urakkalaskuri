import { normalizeFormDefinitionWithWarnings } from '@/src/core/form/formDefinitionHelpers';
import type { FormDefinition } from '@/src/core/form/types';

export class FormDefinitionImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormDefinitionImportError';
  }
}

/** Vie lomakepohja JSON-merkkijonoksi (leikepöytä / tiedosto). */
export function serializeFormDefinition(form: FormDefinition): string {
  return JSON.stringify(form, null, 2);
}

/**
 * Parsii tuodun lomakepohjan ja palauttaa normalisoidun lomakkeen sekä print-huomiot.
 * Kelvoton JSON heittää edelleen FormDefinitionImportError.
 */
export function parseImportedFormDefinitionWithWarnings(raw: string): { form: FormDefinition; warnings: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new FormDefinitionImportError('JSON on tyhjä');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new FormDefinitionImportError('Virheellinen JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new FormDefinitionImportError('Lomakepohjan on oltava JSON-objekti');
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.fields) || !Array.isArray(obj.pages)) {
    throw new FormDefinitionImportError('JSON:sta puuttuu fields- tai pages-taulukko');
  }

  const normalized = normalizeFormDefinitionWithWarnings({
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id : `imported_${Date.now()}`,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Tuotu lomake',
    version: typeof obj.version === 'number' && Number.isFinite(obj.version) ? obj.version : 1,
    pages: obj.pages as FormDefinition['pages'],
    fields: obj.fields as FormDefinition['fields'],
    updatedAt: Date.now(),
  });
  return normalized;
}

/**
 * Parsii tuodun lomakepohjan JSON:sta ja normalisoi (järjestelmäkentät, migraatiot).
 * Huomiot eivät palaudu tästä; käytä parseImportedFormDefinitionWithWarnings.
 */
export function parseImportedFormDefinition(raw: string): FormDefinition {
  return parseImportedFormDefinitionWithWarnings(raw).form;
}

/** Lyhyt kuvaus onnistuneen tuonnin jälkeen. Valinnaiset huomiot: enintään 5 riviä. */
export function importedFormSummary(
  form: FormDefinition,
  previousVersion?: number,
  warnings?: string[],
): string {
  const name = form.name.trim();
  const previous =
    typeof previousVersion === 'number' && Number.isFinite(previousVersion)
      ? ` (edellinen versio: ${previousVersion})`
      : '';
  const version = `Versio ${form.version}${previous}.`;
  const base = name ? `${name}. ${version}` : version;
  if (!warnings?.length) return base;
  const shown = warnings.slice(0, 5);
  const extra = warnings.length - shown.length;
  const lines = extra > 0 ? [...shown, `…ja ${extra} muuta`] : shown;
  return `${base}\nHuomiot:\n${lines.join('\n')}`;
}
