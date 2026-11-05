/**
 * Useimman rakenteen lisätieto. Ensimmäinen ei-tyhjä teksti voittaa;
 * sen jälkeisiä ei tulosteta eikä näytetä rivillä.
 */
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

/** Rivin oma Lisätiedot-kenttä näkyy, kunnes jollakin aiemmalla rivillä on tekstiä. */
export function structureRowShowsAdditionalInfo(
  lines: readonly { id: string; additionalInfo?: string | null }[],
  lineId: string,
): boolean {
  for (const line of lines) {
    if (line.id === lineId) return true;
    if ((line.additionalInfo ?? '').trim()) return false;
  }
  return false;
}
