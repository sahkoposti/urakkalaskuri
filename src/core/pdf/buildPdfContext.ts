import type { CompanyProfile } from '@/src/core/company/types';
import type { AppSettings, CalculationRecord, CustomerInfo, Product, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import type { ProductStructure } from '@/src/core/structure/types';
import { clampDiscountPercent } from '@/src/core/calculation/discount';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { formatCurrency, formatPercent, roundToCents } from '@/src/core/utils/formatters';
import {
  applyVat,
  isPrivateCustomer,
  offerIncludesVat,
  type PriceBreakdownValues,
} from '@/src/core/utils/priceDisplay';

import {
  buildOfferRows,
  buildOfferSections,
  offerSignatureParties,
  offerVatSummary,
  roundedOfferLineAmount,
  sellerContactLines,
  sumOfferHeadingGross,
  sumRoundedOfferLines,
  type OfferRow,
  type OfferSection,
  type OfferVatSummaryRow,
} from './offerDocument';
import type { KtvSettings, OfferCompanySettings, OfferStructureSettings } from './types';
import { readKtvPersons } from './ktvPersons';
import { readOfferValidDays } from './offerValidDays';
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
  /** Yksi summalohko. Alennus täsmää Rivit yhteensä − loppusumma. Yksittäistä verokantaa ei toisteta ALV-taulukkona. */
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
    /**
     * Sama loppusumma kuin sivun 1 Alennettu hinta / Loppusumma.
     * Rivialennuksessa rivien pyöristetty summa, muuten tallennettu summa.
     */
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

function pricedOfferLines(record: CalculationRecord): StructureLine[] {
  return ensureStructureLines(record).filter((line) => line.quantity !== 0 && Number.isFinite(line.quantity));
}

function linesCarryDiscount(record: CalculationRecord): boolean {
  return pricedOfferLines(record).some((line) => clampDiscountPercent(line.discountPercent) > 0);
}

/** Yksi prosentti otsikkoon. Sekalaiset riviprosentit eivät saa yhtä lukua. */
function uniformDiscountPercent(record: CalculationRecord): number | null {
  const lines = pricedOfferLines(record);
  const percents = lines.map((line) => clampDiscountPercent(line.discountPercent));
  if (percents.length > 0 && percents.every((value) => value === percents[0]) && percents[0] > 0) return percents[0];
  if ((percents.length === 0 || percents.every((value) => value === 0)) && record.discountPercent > 0) {
    return record.discountPercent;
  }
  return null;
}

function lineRate(record: CalculationRecord, line: StructureLine): number {
  return Number.isFinite(line.vatPercent) ? line.vatPercent : record.vatPercent;
}

/** ALV, joka sisältyy annettuun bruttosummaan. Brutto − tämä = veroton osa senteissä. */
function vatIncludedInGross(gross: number, rate: number): number {
  if (!(rate > 0) || !Number.isFinite(gross)) return 0;
  return roundToCents(gross - gross / (1 + rate / 100));
}

export type PrintedOfferAmounts = {
  /** Veroton osa senteissä. */
  net: number;
  /** ALV = brutto − veroton, jotta summa täsmää sentille. */
  vat: number;
  /** Loppusumma tai alennettu hinta. Sama luku sivulla 1 ja KTV:ssä. */
  gross: number;
  /**
   * `lines`: loppusumma on rivien pyöristetty summa.
   * `stored`: tallennettu summa (legacy-alennus, ALV 0, tai kelvoton rivi).
   */
  source: 'lines' | 'stored';
};

function storedPrinted(record: CalculationRecord, vatInclusive: boolean): PrintedOfferAmounts {
  const net = roundToCents(record.totalPriceVat0);
  const gross = roundToCents(vatInclusive ? record.totalPriceVat : record.totalPriceVat0);
  return { net: vatInclusive ? net : gross, vat: vatInclusive ? roundToCents(gross - net) : 0, gross, source: 'stored' };
}

/**
 * Tulosteen loppusumma ja sen jako.
 * Yksityinen ilman alennusta: Veroton = rivien pyöristettyjen nettosummien summa
 * (`sumRoundedOfferLines` paid, ilman ALV), Loppusumma = rivien pyöristettyjen
 * bruttosummien summa. ALV on erotus, joten Veroton + ALV = Loppusumma.
 * Brutto / (1 + kanta) ei käy: 3 × 10,01 antaa verottoman 30,02 eikä rivien 30,03.
 * Rivialennus: maksettu rivisumma. Pelkkä laskelman alennus: tallennettu summa.
 * Yrityksen sis. ALV ilman alennusta: Loppusumma on otsikoiden brutto, Veroton tallennettu.
 */
export function printedOfferAmounts(record: CalculationRecord, customer: CustomerInfo): PrintedOfferAmounts {
  const vatInclusive = offerIncludesVat(customer, record.formSnapshot);
  const lineDiscount = linesCarryDiscount(record);
  const discounted = lineDiscount || hasOfferDiscount(record);
  if (discounted) {
    const paid = lineDiscount ? sumRoundedOfferLines(record, vatInclusive, 'paid') : null;
    const gross = paid ?? roundToCents(vatInclusive ? record.totalPriceVat : record.totalPriceVat0);
    if (!vatInclusive) return { net: gross, vat: 0, gross, source: paid != null ? 'lines' : 'stored' };
    const netLines = lineDiscount ? sumRoundedOfferLines(record, false, 'paid') : null;
    const net = netLines ?? roundToCents(record.totalPriceVat0);
    return { net, vat: roundToCents(gross - net), gross, source: paid != null ? 'lines' : 'stored' };
  }
  if (!vatInclusive) return storedPrinted(record, false);
  if (customer.customerType === 'business') {
    const heading = sumOfferHeadingGross(record);
    const gross = heading ?? roundToCents(record.totalPriceVat);
    const net = roundToCents(record.totalPriceVat0);
    return { net, vat: roundToCents(gross - net), gross, source: heading != null ? 'lines' : 'stored' };
  }
  const priced = ensureStructureLines(record).some((line) => line.quantity !== 0 && Number.isFinite(line.quantity));
  const grossLines = priced ? sumRoundedOfferLines(record, true, 'paid') : null;
  const netLines = priced ? sumRoundedOfferLines(record, false, 'paid') : null;
  if (grossLines != null && netLines != null) {
    return { net: netLines, vat: roundToCents(grossLines - netLines), gross: grossLines, source: 'lines' };
  }
  return storedPrinted(record, true);
}

/**
 * Alennettu hinta. Rivialennus: jokaisen rivin pyöristetyn maksetun summan yhteensä
 * (sama sentti kuin hinnoissa). Pelkkä laskelman alennus: tallennettu summa.
 * Ilman alennusta null.
 */
export function offerDiscountedPayable(record: CalculationRecord, customer: CustomerInfo): number | null {
  if (!linesCarryDiscount(record) && !hasOfferDiscount(record)) return null;
  return printedOfferAmounts(record, customer).gross;
}

/**
 * Ruudun kokonaishinta. Rakennerivit: sama luku kuin tulosteen loppusumma.
 * Ilman rivejä tallennettu summa, koska tulosteen rivisummaa ei voi laskea.
 */
export function cardShownTotals(
  values: PriceBreakdownValues,
  customer: CustomerInfo,
): { totalPriceVat0: number; totalPriceVat: number; vatAmount: number; usedPrintedLines: boolean } {
  const lines = (values as Partial<CalculationRecord>).structureLines;
  if (!lines || lines.length === 0) {
    return {
      totalPriceVat0: values.totalPriceVat0,
      totalPriceVat: values.totalPriceVat,
      vatAmount: values.vatAmount,
      usedPrintedLines: false,
    };
  }
  const printed = printedOfferAmounts(values as CalculationRecord, customer);
  return {
    totalPriceVat0: printed.net,
    totalPriceVat: printed.gross,
    vatAmount: printed.vat,
    usedPrintedLines: printed.source === 'lines',
  };
}

/** Historia: yksityinen näkee brutton, yritys verottoman. Luku on tulosteen vastaava sentti. */
export function formatPrintedDisplayPrice(record: CalculationRecord, customer: CustomerInfo): string {
  const shown = cardShownTotals(record, customer);
  return formatCurrency(isPrivateCustomer(customer) ? shown.totalPriceVat : shown.totalPriceVat0);
}

function discountValue(rivit: number, loppu: number): string {
  const amount = roundToCents(rivit - loppu);
  if (amount >= 0) return `−${formatCurrency(amount)}`;
  return formatCurrency(amount);
}

/**
 * Yksi rivi per verokanta, johdettu loppusummasta (tai sen verokannan osuudesta).
 * Sekaverot ja pelkkä laskelman alennus: ei riviä, koska tallennettu summa ei jakaudu riveihin.
 */
function vatIncludedRows(record: CalculationRecord, loppu: number, lineDiscount: boolean): PriceRow[] {
  const lines = pricedOfferLines(record);
  const rates: number[] = [];
  for (const line of lines) {
    const rate = lineRate(record, line);
    if (!rates.includes(rate)) rates.push(rate);
  }
  const rateList = rates.length > 0 ? rates : [record.vatPercent];
  if (rateList.length === 1) {
    const rate = rateList[0];
    return [{ label: `Sisältää ALV ${formatPercent(rate)}`, value: formatCurrency(vatIncludedInGross(loppu, rate)) }];
  }
  if (!lineDiscount) return [];
  return rateList.map((rate) => {
    const groupGross = roundToCents(
      lines
        .filter((line) => lineRate(record, line) === rate)
        .reduce((sum, line) => sum + (roundedOfferLineAmount(line, true, 'paid') ?? 0), 0),
    );
    return { label: `Sisältää ALV ${formatPercent(rate)}`, value: formatCurrency(vatIncludedInGross(groupGross, rate)) };
  });
}

/**
 * Yksi summalohko.
 * Alennus: Rivit yhteensä (otsikoiden listahinnat), Alennus yhteensä (erotus), Alennettu hinta yhteensä.
 * Verollinen alennus: alle rivin Sisältää ALV. Veroton ja ALV-rivit jäävät pois.
 * Ilman alennusta: verollisella Veroton, ALV ja Loppusumma rivien pyöristetystä summasta.
 * ALV 0: vain Loppusumma (Alv 0 %). Yrityksen sis. ALV: Loppusumma on otsikoiden brutto, Veroton tallennettu.
 */
export function offerPriceBlock(record: CalculationRecord, customer: CustomerInfo): TarjousPdfContext['price'] {
  const discounted = linesCarryDiscount(record) || hasOfferDiscount(record);
  const net = record.totalPriceVat0;
  const vatInclusive = offerIncludesVat(customer, record.formSnapshot);
  if (!discounted) {
    if (!vatInclusive) {
      return {
        includesVat: false,
        rows: [{ label: 'Loppusumma (Alv 0 %)', value: formatCurrency(net), emphasis: true }],
      };
    }
    const printed = printedOfferAmounts(record, customer);
    return {
      includesVat: true,
      rows: [
        { label: 'Veroton', value: formatCurrency(printed.net) },
        { label: `ALV ${formatPercent(record.vatPercent)}`, value: formatCurrency(printed.vat) },
        { label: 'Loppusumma', value: formatCurrency(printed.gross), emphasis: true },
      ],
    };
  }

  const listSum = sumRoundedOfferLines(record, vatInclusive, 'list');
  const rivit =
    listSum ??
    roundToCents(vatInclusive ? record.totalPriceVatBeforeDiscount : record.totalPriceVat0BeforeDiscount);
  const loppu = offerDiscountedPayable(record, customer) ?? rivit;
  const percent = uniformDiscountPercent(record);
  const rows: PriceRow[] = [
    { label: 'Rivit yhteensä', value: formatCurrency(rivit) },
    {
      label: percent != null ? `Alennus yhteensä ${formatPercent(percent)}` : 'Alennus yhteensä',
      value: discountValue(rivit, loppu),
    },
    { label: 'Alennettu hinta yhteensä', value: formatCurrency(loppu), emphasis: true },
  ];
  if (vatInclusive) rows.push(...vatIncludedRows(record, loppu, linesCarryDiscount(record)));
  return { includesVat: vatInclusive, rows };
}

export function buildPdfContext(input: BuildPdfContextInput): TarjousPdfContext {
  const { record, company, offerCompany, generatedAt } = input;
  const customer = customerFromRecord(record);
  const offerInfo: PriceRow[] = [
    ...(input.offerNumber != null ? [{ label: 'Tarjousnumero', value: String(input.offerNumber) }] : []),
    { label: 'Päiväys', value: formatFinnishDate(generatedAt) },
    { label: 'Voimassa', value: formatFinnishDate(validUntil(generatedAt, readOfferValidDays(record.formSnapshot, offerCompany.offerValidDays))) },
  ];
  const ktvApplicable = isPrivateCustomer(customer) && !customer.reverseVat;
  const payable = printedOfferAmounts(record, customer).gross;
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
          totalPriceVat: payable,
          materialsVat: Math.round(applyVat(record.materialsVat0, record.vatPercent) * 100) / 100,
          settings: offerCompany.ktv,
          footnoteText: offerCompany.ktvFootnoteText,
          persons: readKtvPersons(record.formSnapshot),
        }
      : undefined,
  };
}
