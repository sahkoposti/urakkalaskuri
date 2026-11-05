/**
 * Rakenteen oma Lisätiedot. Lähde on tuoterakenteen `defaultAdditionalInfo`,
 * joka kopioidaan rivin `additionalInfo`-kenttään. Tuloste ja rivin näyttö
 * käyttävät samaa ensimmäisen tekstin valintaa.
 */

export type StructureLisatiedotLine = {
  id: string;
  structureId?: string;
  additionalInfo?: string | null;
};

export type StructureLisatiedotSource = {
  id: string;
  defaultAdditionalInfo?: string | null;
};

/** Rivin teksti, tai rakenteen oletus jos riville ei ole kopiota. */
export function lineStructureLisatiedot(
  line: StructureLisatiedotLine,
  structures?: readonly StructureLisatiedotSource[],
): string {
  const copied = (line.additionalInfo ?? '').trim();
  if (copied) return copied;
  if (!line.structureId) return '';
  const structure = structures?.find((item) => item.id === line.structureId);
  return (structure?.defaultAdditionalInfo ?? '').trim();
}

export function firstPrintedStructureNote<T extends { id: string }>(
  lines: readonly T[],
  textFor: (line: T) => string | null | undefined,
): { lineId: string; text: string } | null {
  for (const line of lines) {
    const text = (textFor(line) ?? '').trim();
    if (text) return { lineId: line.id, text };
  }
  return null;
}

/**
 * Ensimmäinen laskentajärjestyksessä oleva rivi, jolla on tekstiä.
 * Myöhempien rivien tekstiä ei tulosteta eikä näytetä.
 */
export function firstStructureLisatiedot(
  lines: readonly StructureLisatiedotLine[],
  structures?: readonly StructureLisatiedotSource[],
): { lineId: string; text: string } | null {
  return firstPrintedStructureNote(lines, (line) => lineStructureLisatiedot(line, structures));
}

/** Sama valinta kuin tulosteessa: vain voittava rivi näyttää Lisätiedot-kentän. */
export function structureRowShowsAdditionalInfo(
  lines: readonly StructureLisatiedotLine[],
  lineId: string,
  structures?: readonly StructureLisatiedotSource[],
): boolean {
  return firstStructureLisatiedot(lines, structures)?.lineId === lineId;
}
