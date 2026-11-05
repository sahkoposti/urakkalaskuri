/**
 * Rakenteen oma Lisätiedot.
 *
 * Uusi rivi saa rakenteen oletustekstin omaan `additionalInfo`-kenttäänsä luontihetkellä.
 * Tyhjä merkkijono on tietoinen tyhjennys: sitä ei täytetä uudelleen eikä tulosteta.
 * Kentän puuttuminen (vanha laskelma) käyttää edelleen rakenteen nykyistä oletusta.
 * Ensimmäinen tuoterakenne, jolla on tekstiä, voittaa. Manuaalirivin kuvaus ei ole
 * tässä valinnassa mukana.
 */
import { isManualStructureId } from '@/src/core/structure/types';

export type StructureLisatiedotLine = {
  id: string;
  structureId?: string;
  additionalInfo?: string | null;
};

export type StructureLisatiedotSource = {
  id: string;
  defaultAdditionalInfo?: string | null;
  form?: unknown;
};

function structureFor(
  line: StructureLisatiedotLine,
  structures?: readonly StructureLisatiedotSource[],
): StructureLisatiedotSource | undefined {
  if (!line.structureId) return undefined;
  return structures?.find((item) => item.id === line.structureId);
}

/** Tuoterakenteen rivi. Manuaalirivi ja lomakkeeton rivi eivät osallistu Lisätiedot-valintaan. */
export function isProductStructureLisatiedotLine(
  line: StructureLisatiedotLine,
  structures?: readonly StructureLisatiedotSource[],
): boolean {
  if (!line.structureId || isManualStructureId(line.structureId)) return false;
  return structureFor(line, structures)?.form != null;
}

/**
 * Rivin oma teksti. Tyhjä merkkijono jää tyhjäksi.
 * Vain puuttuva kenttä lukee rakenteen oletuksen.
 */
export function lineStructureLisatiedot(
  line: StructureLisatiedotLine,
  structures?: readonly StructureLisatiedotSource[],
): string {
  if (typeof line.additionalInfo === 'string') return line.additionalInfo.trim();
  return (structureFor(line, structures)?.defaultAdditionalInfo ?? '').trim();
}

/** Kentän arvo laskentasivulla. Tyhjennettyä riviä ei täytetä rakenteen oletuksella. */
export function structureLineAdditionalInfoInputValue(
  line: { additionalInfo?: string | null },
  structure?: { defaultAdditionalInfo?: string | null } | null,
): string {
  if (typeof line.additionalInfo === 'string') return line.additionalInfo;
  return structure?.defaultAdditionalInfo ?? '';
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
 * Ensimmäinen tuoterakenne laskentajärjestyksessä, jolla on tekstiä.
 * Myöhemmän rakenteen tekstiä ei tulosteta eikä näytetä.
 */
export function firstStructureLisatiedot(
  lines: readonly StructureLisatiedotLine[],
  structures?: readonly StructureLisatiedotSource[],
): { lineId: string; text: string } | null {
  return firstPrintedStructureNote(
    lines.filter((line) => isProductStructureLisatiedotLine(line, structures)),
    (line) => lineStructureLisatiedot(line, structures),
  );
}

/**
 * Tuoterakenteella vain voittava rivi näyttää Lisätiedot-kentän.
 * Manuaalirivin oma kuvaus näkyy aina.
 */
export function structureRowShowsAdditionalInfo(
  lines: readonly StructureLisatiedotLine[],
  lineId: string,
  structures?: readonly StructureLisatiedotSource[],
): boolean {
  const line = lines.find((item) => item.id === lineId);
  if (!line) return false;
  if (!isProductStructureLisatiedotLine(line, structures)) return true;
  return firstStructureLisatiedot(lines, structures)?.lineId === lineId;
}
