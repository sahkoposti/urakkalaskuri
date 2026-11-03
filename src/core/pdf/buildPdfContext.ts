import type { CompanyProfile } from '@/src/core/company/types';
import type { AppSettings, CalculationRecord, CustomerInfo, Product } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import type { ProductStructure } from '@/src/core/structure/types';
import { formatCurrency, formatPercent, roundToCents } from '@/src/core/utils/formatters';
import { applyVat, isPrivateCustomer, offerIncludesVat } from '@/src/core/utils/priceDisplay';

import {
  buildOfferRows,
  buildOfferSections,
  offerSignatureParties,
  offerVatSummary,
  sellerContactLines,
  sumOfferHeadingGross,
  sumOfferListGross,
  type OfferRow,
  type OfferSection,
  type OfferVatSummaryRow,
} from './offerDocument';
import type { KtvSettings, OfferCompanySettings, OfferStructureSettings } from './types';
import { readKtvPersons } from './ktvPersons';
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
  /** ALV-erittely maksun jälkeen. Yrityksen ALV 0 ja käänteinen ALV: tyhjä. Sis. ALV: otsikoiden summa. */
  vatSummary: OfferVatSummaryRow[];
  /** Yksi summalohko. Alennus on veroton. Yksittäistä verokantaa ei toisteta ALV-taulukkona. */
  price: { includesVat: boolean; rows: PriceRow[] };
  /** Yrityksen Lisätiedot-teksti. Tyhjä = osio pois. */
  additionalInfo: string;
  /** Myyjän yhteystiedot. Tyhjä = lohko pois. */
  sellerLines: string[];
  /** Allekirjoituslohko. Tyhjät nimet jätetään pois; viivat tulostetaan silti. */
  signature: { sellerLines: string[]; customerName: string };
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
    /** Henkilömäärä laskelman form_snapshot.ktvPersons-avaimesta. Puuttuva = 1. */
    persons: number;
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

function hasOfferDiscount(record: CalculationRecord): boolean {
  return record.discountPercent > 0 && record.totalPriceVat0BeforeDiscount > record.totalPriceVat0;
}

function discountRow(record: CalculationRecord, amount: number): PriceRow {
  return {
    label: `Alennus ${formatPercent(record.discountPercent)}`,
    value: `−${formatCurrency(roundToCents(amount))}`,
  };
}

/**
 * Yksi summalohko. Alennus on aina veroton.
 * Verollinen: Hinta alv0 ja Alennus vain alennuksella, sitten Veroton, ALV ja Loppusumma.
 * Veroton tarjous: Veroton-rivi jätetään pois, koska se olisi sama kuin Loppusumma.
 * Yrityksen sis. ALV: Loppusumma on otsikoiden bruttosumma.
 */
export function offerPriceBlock(record: CalculationRecord, customer: CustomerInfo): TarjousPdfContext['price'] {
  const discounted = hasOfferDiscount(record);
  const listNet = discounted ? record.totalPriceVat0BeforeDiscount : record.totalPriceVat0;
  const net = record.totalPriceVat0;
  const vatInclusive = offerIncludesVat(customer, record.formSnapshot);
  if (vatInclusive && customer.customerType === 'business') {
    const afterGross = sumOfferHeadingGross(record);
    const beforeGross = sumOfferListGross(record);
    const linesCarryDiscount = afterGross != null && beforeGross != null && beforeGross > afterGross;
    if (afterGross != null && beforeGross != null && !(discounted && !linesCarryDiscount)) {
      const rows: PriceRow[] = [];
      if (discounted && linesCarryDiscount) {
        rows.push({ label: 'Hinta alv0', value: formatCurrency(listNet) });
        rows.push(discountRow(record, listNet - net));
      }
      rows.push(
        { label: 'Veroton', value: formatCurrency(net) },
        { label: `ALV ${formatPercent(record.vatPercent)}`, value: formatCurrency(roundToCents(afterGross - net)) },
        { label: 'Loppusumma', value: formatCurrency(afterGross), emphasis: true },
      );
      return { includesVat: true, rows };
    }
  }
  if (vatInclusive) {
    const rows: PriceRow[] = [];
    if (discounted) {
      rows.push({ label: 'Hinta alv0', value: formatCurrency(listNet) });
      rows.push(discountRow(record, listNet - net));
    }
    rows.push(
      { label: 'Veroton', value: formatCurrency(net) },
      { label: `ALV ${formatPercent(record.vatPercent)}`, value: formatCurrency(roundToCents(record.totalPriceVat - net)) },
      { label: 'Loppusumma', value: formatCurrency(record.totalPriceVat), emphasis: true },
    );
    return { includesVat: true, rows };
  }
  const rows: PriceRow[] = [{ label: 'Hinta alv0', value: formatCurrency(listNet) }];
  if (discounted) rows.push(discountRow(record, listNet - net));
  rows.push({ label: 'Loppusumma', value: formatCurrency(net), emphasis: true });
  return { includesVat: false, rows };
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
    signature: offerSignatureParties(company, customer.name),
    footer: buildFooter(company),
    ktv: ktvApplicable
      ? {
          totalPriceVat: record.totalPriceVat,
          materialsVat: Math.round(applyVat(record.materialsVat0, record.vatPercent) * 100) / 100,
          settings: offerCompany.ktv,
          footnoteText: offerCompany.ktvFootnoteText,
          persons: readKtvPersons(record.formSnapshot),
        }
      : undefined,
  };
}
