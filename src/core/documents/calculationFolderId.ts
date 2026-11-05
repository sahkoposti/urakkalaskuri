/**
 * Laskelman kansion nimi.
 * Tunnisteet tulevat `expo-crypto` `randomUUID()`-funktiosta (heksa ja viiva).
 * Testien ja vanhojen fixture-tunnisteiden (`calc-b`, `id-1`, `fin-1`, `draft-fail`)
 * merkit mahtuvat samaan joukkoon. Kelvollinen tunnus on sama segmentti,
 * jolla kansio luodaan: dokumenteilla raaka tunnus, liitteillä `safeSegment`,
 * joka ei muuta tätä joukkoa.
 */
export const CALCULATION_FOLDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const UNSAFE_CALCULATION_FOLDER_ID_WARNING =
  'Laskelman kansiota ei poistettu, virheellinen tunniste';

export function isSafeCalculationFolderId(value: string): boolean {
  return CALCULATION_FOLDER_ID_PATTERN.test(value);
}
