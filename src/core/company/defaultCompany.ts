import type { CompanyProfile } from './types';

/** ColoRajaton Oy:n julkiset yhteystiedot oletuksina (suunnitelma §1.5 / §5). */
export const defaultCompanyProfile: Readonly<CompanyProfile> = Object.freeze({
  companyName: 'ColoRajaton Oy',
  address: 'Toivonlinnantie 350',
  postalCode: '21500',
  postalLocality: 'Piikkiö',
  website: 'www.colorajaton.fi',
  email: 'info@colorajaton.fi',
  businessId: '3224017-2',
  phone: '+358 40 938 9403',
  sellerName: '',
  sellerPhone: '',
  sellerEmail: '',
});

const STRING_KEYS = [
  'companyName',
  'address',
  'postalCode',
  'postalLocality',
  'website',
  'email',
  'businessId',
  'phone',
  'sellerName',
  'sellerPhone',
  'sellerEmail',
] as const satisfies readonly (keyof CompanyProfile)[];

/**
 * Yhdistää tallennetun (osittaisen tai rikkinäisen) arvon oletuksiin.
 * Tyhjä merkkijono on sallittu ja säilyy (käyttäjä on tyhjentänyt kentän);
 * oletus käytetään vain, kun kenttä puuttuu tai ei ole merkkijono.
 */
export function normalizeCompanyProfile(raw: unknown): CompanyProfile {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const result: CompanyProfile = { ...defaultCompanyProfile };
  for (const key of STRING_KEYS) {
    const value = src[key];
    if (typeof value === 'string') result[key] = value;
  }
  if (typeof src.logoUri === 'string' && src.logoUri.trim() !== '') {
    result.logoUri = src.logoUri.trim();
  }
  return result;
}

/** Lukee tallennetun JSON-tekstin; virheellinen JSON → oletukset. */
export function parseStoredCompanyProfile(value: string | null | undefined): CompanyProfile {
  if (!value) return normalizeCompanyProfile(undefined);
  try {
    return normalizeCompanyProfile(JSON.parse(value));
  } catch {
    return normalizeCompanyProfile(undefined);
  }
}

/** Siistii lomakkeen arvot tallennusta varten (trim). */
export function cleanCompanyProfile(profile: CompanyProfile): CompanyProfile {
  const cleaned = normalizeCompanyProfile(profile);
  for (const key of STRING_KEYS) cleaned[key] = (cleaned[key] ?? '').trim();
  return cleaned;
}

export function companyProfilesEqual(a: CompanyProfile, b: CompanyProfile): boolean {
  return STRING_KEYS.every((key) => a[key] === b[key]) && (a.logoUri ?? '') === (b.logoUri ?? '');
}

export const COMPANY_PROFILE_FIELDS = STRING_KEYS;
