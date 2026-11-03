/** Yrityksen tiedot (Asetukset → Yritys). Käytetään PDF:n ylä- ja alatunnisteessa (v1.3). */
export interface CompanyProfile {
  companyName: string;
  /** Katuosoite */
  address: string;
  postalCode: string;
  postalLocality: string;
  website: string;
  email: string;
  /** Y-tunnus */
  businessId: string;
  phone: string;
  /** Myyjän nimi (ei footer-pohjassa) */
  sellerName: string;
  /** Myyjän puhelin. Tyhjä = yrityksen puhelin. */
  sellerPhone?: string;
  /** Myyjän sähköposti. Tyhjä = yrityksen sähköposti. */
  sellerEmail?: string;
  /** Ylätunnisteen logo; tyhjä = paketoitu ColoRajaton-oletus. Oma tiedosto ei kuulu v1.3:een. */
  logoUri?: string;
}

export const COMPANY_PROFILE_SETTINGS_KEY = 'company_profile';
