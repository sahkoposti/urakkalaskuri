/** Tuoterakennerivin Lisätiedot-kenttä on oletuksena kiinni. */
export const STRUCTURE_LINE_ADDITIONAL_INFO_DEFAULT_EXPANDED = false;

export function structureLineAdditionalInfoCollapsed(
  expanded: boolean,
  text: string,
): boolean {
  if (expanded) return false;
  return true;
}

export function structureLineAdditionalInfoHasText(text: string): boolean {
  return text.trim().length > 0;
}
