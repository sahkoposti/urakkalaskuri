import type { CompanyProfile } from '@/src/core/company/types';
import type { AppSettings, CalculationRecord, CustomerInfo, Product } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import type { ProductStructure } from '@/src/core/structure/types';
import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';
import { applyVat, customerSeesVatInclusive, isPrivateCustomer } from '@/src/core/utils/priceDisplay';

import {
  buildOfferRows,
  buildOfferSections,
  offerVatSummary,
  sellerContactLines,
  type OfferRow,
  type OfferSection,
  type OfferVatSummaryRow,
} from './offerDocument';
import type { KtvSettings, OfferCompanySettings, OfferStructureSettings } from './types';
import { formatFinnishDate, validUntil } from './validUntil';

export type PriceRow = { label: string; value: string; emphasis?: boolean };

export type PdfFooter = { left: string[]; center: string[]; right: string[] };

export type TarjousPdfContext = {
  kind: 'tarjous';
  logoUri?: string;
  customerLines: string[];
  offerInfo: PriceRow[];
  /** Rivitaulukko tallennetussa järjestyksessä (rakenteet ja manuaalirivit). */
  rows: OfferRow[];
  /** Rakennekohtaiset osiot taulukon jälkeen. Manuaalirivillä ei ole osiota. */
  sections: OfferSection[];
  /** Laskelman toimitusajankohta. Tyhjä = ei tulosteta. */
  deliveryScheduleText: string;
  /** ALV-erittely maksun jälkeen. Yritys ja käänteinen ALV: tyhjä. */
  vatSummary: OfferVatSummaryRow[];
  price: { includesVat: boolean; left: PriceRow[]; right: PriceRow[] };
  /** Yrityksen Lisätiedot-teksti. Tyhjä = osio pois. */
  additionalInfo: string;
  /** Myyjän yhteystiedot. Tyhjä = lohko pois. */
  sellerLines: string[];
  footer: PdfFooter;
  /** Kotitalousvähennyssivu: vain yksityisasiakas ilman käänteistä ALV:ta. */
  ktv?: {
    /** Kokonaishinta sis. ALV alennuksen jälkeen. */
    totalPriceVat: number;
    /** Materiaalit sis. ALV sellaisenaan; alennus pienentää vain työn osuutta (kotitalousDeduction.ktvPriceSplit). */
    materialsVat: number;
    /** Yrityskohtaiset asetukset (Tarjous-asetukset), ei kovakoodattuja arvoja. */
    settings: KtvSettings;
    /** Asetusten huomautusteksti; tyhjä → oletusteksti. */
    footnoteText: string;
  };
};

export type BuildPdfContextInput = {
  record: CalculationRecord;
  company: CompanyProfile;
  offerCompany: OfferCompanySettings;
  /** Rakennekohtaiset tarjousasetukset structureId:n mukaan. */
  offerStructureSettings: Record<string, OfferStructureSettings | undefined>;
  structures: ProductStructure[];
  products: Product[];
  settings: AppSettings;
  generatedAt: Date;
  /** Myönnetty tarjousnumero (T5); puuttuu → rivi jätetään pois. */
  offerNumber?: number;
};

const nonEmpty = (values: (string | undefined)[]) =>
  values.map((value) => value?.trim() ?? '').filter((value) => value.length > 0);

export function buildFooter(company: CompanyProfile): PdfFooter {
  const postal = nonEmpty([company.postalCode, company.postalLocality]).join(' ');
  return {
    left: nonEmpty([company.companyName, company.address, postal]),
    center: nonEmpty([company.website, company.email]),
    right: nonEmpty([
      company.businessId.trim() ? `Y-tunnus: ${company.businessId.trim()}` : '',
      company.phone.trim() ? `Puh. ${company.phone.trim()}` : '',
    ]),
  };
}

export function customerHeaderLines(customer: CustomerInfo): string[] {
  const postal = nonEmpty([customer.postalCode, customer.postalLocality]).join(' ');
  const addressLine = nonEmpty([customer.address, postal]).join(', ');
  return nonEmpty([customer.name, addressLine, customer.phone, customer.email]);
}

/**
 * Hintaerittely (suunnitelma §1.3). Ei kate-/palkkiorivejä.
 * Alennuksella "Hinta alv0", "ALV" ja "Hinta alv" näytetään ennen alennusta ja Loppusumma alennuksen jälkeen
 * (muuten Ale % -rivi näyttäisi, ettei alennusta ole huomioitu). Ilman alennusta kaikki ovat samat kuin tallennettu.
 */
export function offerPriceBlock(record: CalculationRecord, customer: CustomerInfo): TarjousPdfContext['price'] {
  const hasDiscount = record.discountPercent > 0 && record.totalPriceVat0BeforeDiscount > record.totalPriceVat0;
  const listVat0 = hasDiscount ? record.totalPriceVat0BeforeDiscount : record.totalPriceVat0;
  const vatInclusive = customerSeesVatInclusive(customer);
  // Eemil 29.10.2026 #2: alennus omana rivinään (prosentti + euromäärä), muut rivit ennallaan.
  const discountAmount = vatInclusive
    ? record.totalPriceVatBeforeDiscount - record.totalPriceVat
    : record.totalPriceVat0BeforeDiscount - record.totalPriceVat0;
  const discountRow: PriceRow[] = hasDiscount
    ? [{ label: `Alennus ${formatPercent(record.discountPercent)}`, value: `−${formatCurrency(discountAmount)}` }]
    : [];

  if (vatInclusive) {
    const listVat = hasDiscount ? record.totalPriceVatBeforeDiscount : record.totalPriceVat;
    const vatAmount = hasDiscount ? listVat - listVat0 : record.vatAmount;
    return {
      includesVat: true,
      left: [
        { label: 'Hinta alv0', value: formatCurrency(listVat0) },
        { label: `ALV ${formatPercent(record.vatPercent)}`, value: formatCurrency(vatAmount) },
      ],
      right: [
        { label: 'Hinta alv', value: formatCurrency(listVat) },
        ...discountRow,
        { label: 'Loppusumma', value: formatCurrency(record.totalPriceVat), emphasis: true },
      ],
    };
  }
  // Yritys ja käänteinen ALV: aina alv0, ei ALV-rivejä eikä "Käänteinen ALV" -tekstiä.
  return {
    includesVat: false,
    left: [{ label: 'Hinta alv0', value: formatCurrency(listVat0) }],
    right: [...discountRow, { label: 'Loppusumma', value: formatCurrency(record.totalPriceVat0), emphasis: true }],
  };
}

export function buildPdfContext(input: BuildPdfContextInput): TarjousPdfContext {
  const { record, company, offerCompany, generatedAt } = input;
  const customer = customerFromRecord(record);
  const offerInfo: PriceRow[] = [
    ...(input.offerNumber != null ? [{ label: 'Tarjousnumero', value: String(input.offerNumber) }] : []),
    { label: 'Päiväys', value: formatFinnishDate(generatedAt) },
    { label: 'Voimassa', value: formatFinnishDate(validUntil(generatedAt, offerCompany.offerValidDays)) },
  ];
  const ktvApplicable = isPrivateCustomer(customer) && !customer.reverseVat;
  return {
    kind: 'tarjous',
    logoUri: company.logoUri,
    customerLines: customerHeaderLines(customer),
    offerInfo,
    rows: buildOfferRows(input),
    sections: buildOfferSections(input),
    deliveryScheduleText: record.deliveryScheduleText?.trim() ?? '',
    vatSummary: offerVatSummary(record, customer),
    price: offerPriceBlock(record, customer),
    additionalInfo: typeof offerCompany.additionalInfoText === 'string' ? offerCompany.additionalInfoText : '',
    sellerLines: sellerContactLines(company),
    footer: buildFooter(company),
    ktv: ktvApplicable
      ? {
          totalPriceVat: record.totalPriceVat,
          materialsVat: Math.round(applyVat(record.materialsVat0, record.vatPercent) * 100) / 100,
          settings: offerCompany.ktv,
          footnoteText: offerCompany.ktvFootnoteText,
        }
      : undefined,
  };
}
