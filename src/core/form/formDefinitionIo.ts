import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
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
 * Parsii tuodun lomakepohjan JSON:sta ja normalisoi (järjestelmäkentät, migraatiot).
 */
export function parseImportedFormDefinition(raw: string): FormDefinition {
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

  return normalizeFormDefinition({
    id: typeof obj.id === 'string' && obj.id.trim() ? obj.id : `imported_${Date.now()}`,
    name: typeof obj.name === 'string' && obj.name.trim() ? obj.name : 'Tuotu lomake',
    version: typeof obj.version === 'number' && Number.isFinite(obj.version) ? obj.version : 1,
    pages: obj.pages as FormDefinition['pages'],
    fields: obj.fields as FormDefinition['fields'],
    updatedAt: Date.now(),
  });
}

/** Lyhyt kuvaus onnistuneen tuonnin jälkeen. */
export function importedFormSummary(form: FormDefinition, previousVersion?: number): string {
  const name = form.name.trim();
  const previous =
    typeof previousVersion === 'number' && Number.isFinite(previousVersion)
      ? ` (edellinen versio: ${previousVersion})`
      : '';
  const version = `Versio ${form.version}${previous}.`;
  return name ? `${name}. ${version}` : version;
}
