import type { CompanyProfile } from '@/src/core/company/types';
import type { AppSettings, CalculationRecord, CustomerInfo, Product } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import type { ProductStructure } from '@/src/core/structure/types';
import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';
import { applyVat, customerSeesVatInclusive, isPrivateCustomer } from '@/src/core/utils/priceDisplay';

import { filterOfferCards, lineSpecSnapshot, specCardsFromSnapshot, type SpecCard } from './offerPageSpecs';
import { specGridLayout, type SpecGridLayout } from './specGridLayout';
import { enabledOfferPageIds } from './syncOfferPages';
import type { OfferCompanySettings, OfferStructureSettings } from './types';
import { formatFinnishDate, validUntil } from './validUntil';

export type PriceRow = { label: string; value: string; emphasis?: boolean };

export type PdfFooter = { left: string[]; center: string[]; right: string[] };

export type TarjousPdfContext = {
  kind: 'tarjous';
  logoUri?: string;
  customerLines: string[];
  offerInfo: PriceRow[];
  specGrid: SpecGridLayout;
  price: { includesVat: boolean; left: PriceRow[]; right: PriceRow[] };
  additionalInfo: string;
  footer: PdfFooter;
  /** Kotitalousvähennyssivu: vain yksityisasiakas ilman käänteistä ALV:ta. */
  khv?: {
    /** Kokonaishinta sis. ALV alennuksen jälkeen. */
    totalPriceVat: number;
    /** Materiaalit sis. ALV sellaisenaan (ks. kotitalousDeduction.khvWorkShareVatIncluded). */
    materialsVat: number;
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
  const discountRow: PriceRow[] = hasDiscount ? [{ label: 'Ale %', value: formatPercent(record.discountPercent) }] : [];
  const listVat0 = hasDiscount ? record.totalPriceVat0BeforeDiscount : record.totalPriceVat0;

  if (customerSeesVatInclusive(customer)) {
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

/**
 * Lisätiedot-teksti (Eemil 29.10.2026): rakennekohtainen; usean rakenteen laskelmassa ENSIMMÄISEN rakenteen teksti.
 * Lähde nyt: Tarjous-asetusten rakennekohtainen teksti (T4). AINOA paikka, jossa lähde valitaan.
 */
export function offerAdditionalInfo(
  record: CalculationRecord,
  offerStructureSettings: BuildPdfContextInput['offerStructureSettings'],
): string {
  const first = ensureStructureLines(record)[0];
  if (!first) return '';
  return offerStructureSettings[first.structureId]?.additionalInfoText?.trim() ?? '';
}

export function offerSpecCards(input: BuildPdfContextInput): SpecCard[] {
  const customer = customerFromRecord(input.record);
  const lines = ensureStructureLines(input.record);
  const perLine = lines.map((line) => {
    const structure = input.structures.find((item) => item.id === line.structureId);
    const snapshot = lineSpecSnapshot(
      line,
      structure,
      input.products,
      input.settings,
      Boolean(customer.reverseVat),
      input.record.travelTimeHoursOneWay,
    );
    const cards = specCardsFromSnapshot(snapshot, structure?.form);
    const enabled = structure
      ? new Set(enabledOfferPageIds(structure.form, input.offerStructureSettings[line.structureId]))
      : new Set<string>();
    return { line, cards: filterOfferCards(cards, enabled) };
  });
  const linesWithCards = perLine.filter((item) => item.cards.length > 0).length;
  return perLine.flatMap(({ line, cards }) =>
    linesWithCards > 1 ? cards.map((card) => ({ ...card, title: `${line.name}: ${card.title}` })) : cards,
  );
}

export function buildPdfContext(input: BuildPdfContextInput): TarjousPdfContext {
  const { record, company, offerCompany, generatedAt } = input;
  const customer = customerFromRecord(record);
  const offerInfo: PriceRow[] = [
    ...(input.offerNumber != null ? [{ label: 'Tarjousnumero', value: String(input.offerNumber) }] : []),
    { label: 'Päiväys', value: formatFinnishDate(generatedAt) },
    { label: 'Voimassa', value: formatFinnishDate(validUntil(generatedAt, offerCompany.offerValidDays)) },
  ];
  const khvApplicable = isPrivateCustomer(customer) && !customer.reverseVat;
  return {
    kind: 'tarjous',
    logoUri: company.logoUri,
    customerLines: customerHeaderLines(customer),
    offerInfo,
    specGrid: specGridLayout(offerSpecCards(input)),
    price: offerPriceBlock(record, customer),
    additionalInfo: offerAdditionalInfo(record, input.offerStructureSettings),
    footer: buildFooter(company),
    khv: khvApplicable
      ? {
          totalPriceVat: record.totalPriceVat,
          materialsVat: Math.round(applyVat(record.materialsVat0, record.vatPercent) * 100) / 100,
        }
      : undefined,
  };
}
