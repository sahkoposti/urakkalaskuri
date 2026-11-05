/**
 * Rakenteen oma Lisätiedot.
 *
 * Uusi rivi (`emptyStructureLine`) kopioi rakenteen oletustekstin omaan
 * `additionalInfo`-kenttäänsä luontihetkellä. Tyhjä merkkijono on tyhjennys.
 * Tallennetulta riviltä puuttuva kenttä on tyhjä: tuloste ja kenttä eivät lue
 * rakenteen nykyistä `defaultAdditionalInfo`-oletusta.
 * Ensimmäinen tuoterakenne, jolla on tekstiä, voittaa. Manuaalirivin kuvaus ei ole
 * tässä valinnassa mukana. Lomakkeeton tai puuttuva rakenne osallistuu, jos rivillä
 * on rakennetunnus eikä se ole manuaalirivi.
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

/** Tuoterakenteen rivi. Manuaalirivi ei osallistu Lisätiedot-valintaan. */
export function isProductStructureLisatiedotLine(
  line: StructureLisatiedotLine,
  _structures?: readonly StructureLisatiedotSource[],
): boolean {
  return Boolean(line.structureId) && !isManualStructureId(line.structureId ?? '');
}

/**
 * Rivin oma teksti. Merkkijono, myös tyhjä, käytetään sellaisenaan.
 * Puuttuva kenttä on tyhjä, eikä rakenteen oletusta lueta.
 */
export function lineStructureLisatiedot(
  line: StructureLisatiedotLine,
  _structures?: readonly StructureLisatiedotSource[],
): string {
  return typeof line.additionalInfo === 'string' ? line.additionalInfo.trim() : '';
}

/** Kentän arvo laskentasivulla. Puuttuvaa tai tyhjää arvoa ei täytetä rakenteen oletuksella. */
export function structureLineAdditionalInfoInputValue(
  line: { additionalInfo?: string | null },
  _structure?: { defaultAdditionalInfo?: string | null } | null,
): string {
  return typeof line.additionalInfo === 'string' ? line.additionalInfo : '';
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
