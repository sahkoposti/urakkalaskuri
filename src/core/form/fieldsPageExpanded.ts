/** Kentät-asetusten sivukohtainen avaus/sulku. Puuttuva avain = suljettu. */
export const UNASSIGNED_FIELDS_SECTION_ID = '__unassigned';

export type FieldsPageExpandedMap = Record<string, boolean>;

export function parseFieldsPageExpanded(raw: string | null | undefined): FieldsPageExpandedMap {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: FieldsPageExpandedMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function isFieldsPageExpanded(map: FieldsPageExpandedMap, pageId: string): boolean {
  return map[pageId] === true;
}

export function toggleFieldsPageExpanded(
  map: FieldsPageExpandedMap,
  pageId: string,
): FieldsPageExpandedMap {
  return {
    ...map,
    [pageId]: !isFieldsPageExpanded(map, pageId),
  };
}
