import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import type { CompanyProfile } from '@/src/core/company/types';
import { buildCalculationFormulaContext } from '@/src/core/form/calculationFormulaContext';
import type { AppSettings, CalculationRecord, CustomerInfo, Product, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { lineListPriceVat0, lineTotalVat0 } from '@/src/core/structure/linePricing';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
import type { ProductStructure } from '@/src/core/structure/types';
import { isManualStructureId } from '@/src/core/structure/types';
import { resolveDisplayedWorkDurationDays } from '@/src/core/structure/workDurationDisplay';
import { clampDiscountPercent } from '@/src/core/calculation/discount';
import { formatCurrency, formatPercent, formatPrintedQuantity, roundToCents } from '@/src/core/utils/formatters';
import { applyVat, offerIncludesVat } from '@/src/core/utils/priceDisplay';

import { lineSpecSnapshot } from './offerPageSpecs';
import { printableFields, type PrintRow } from './printableFields';
import { appendPrintedText, buildPrintedBody, type PrintedTableRow, type PrintedTextGroup } from './printedSection';
import type { OfferStructureSettings } from './types';

/**
 * Tarjouksen rivit ja rakenneosiot (P3). Hinnat tulevat rivin kentistä ja
 * `lineTotalVat0`-funktiosta; ALV-erittelyn summat tallennetusta laskelmasta.
 */

export type OfferRow = {
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatPercent: string;
  /** Mukana vain, kun taulukossa on Ale %-sarake. */
  discountPercent?: string;
  total: string;
  /** Vain manuaalirivin lisätieto. */
  description?: string;
};

export type OfferHeading = {
  /** Määrä ja yksikkö samassa merkkijonossa. Kokonaisluku ilman desimaalia. */
  quantityLabel: string;
  /** Määrä-sarake. `formatPrintedQuantity`: kokonaisluku ilman desimaaleja. */
  quantity: string;
  /** Yks.-sarake. Rivin yksikkö. Tyhjä, jos rivillä ei ole yksikköä. */
  unit: string;
  /** A-hinta. Tyhjä, jos hinta on kelvoton. */
  unitPrice: string;
  /** Rivisumma (Yht.). Tyhjä, jos hinta on kelvoton. */
  price: string;
  /**
   * Alv-%-sarake.
   * ALV 0 ja käänteinen ALV → "Alv 0 %".
   * Verollinen hinta (yritys sis. ALV ja yksityinen) → rivin ALV-%, esim. "25,5 %".
   */
  vatLabel?: string;
};

export type OfferSection = {
  title: string;
  /** Puuttuu, kun määrä on 0 (riviä ei hinnoitella). */
  heading?: OfferHeading;
  /** Manuaalirivin lisätieto otsikon alla. Rakenteen Muuta on textGroupsissa. */
  description?: string;
  textGroups: PrintedTextGroup[];
  tableRows: PrintedTableRow[];
};

export type OfferVatSummaryRow = {
  vatPercent: number;
  /** Veroton, alennuksen jälkeen (tallennettu laskelma). */
  net: number;
  vat: number;
  gross: number;
};

export type OfferDocumentSource = {
  record: CalculationRecord;
  structures: ProductStructure[];
  products: Product[];
  settings: AppSettings;
  offerStructureSettings: Record<string, OfferStructureSettings | undefined>;
};

function formatQuantity(value: number): string {
  return formatPrintedQuantity(value);
}

/** Asiakkaalle tulostettava summa. null = NaN, Infinity tai muu kelvoton luku. */
function offerAmount(vat0: number, includesVat: boolean, vatPercent: number): number | null {
  if (!Number.isFinite(vat0)) return null;
  if (includesVat && !Number.isFinite(vatPercent)) return null;
  const amount = includesVat ? applyVat(vat0, vatPercent) : vat0;
  return Number.isFinite(amount) ? amount : null;
}

function formatOfferMoney(vat0: number, includesVat: boolean, vatPercent: number): string {
  const amount = offerAmount(vat0, includesVat, vatPercent);
  if (amount == null) return '';
  return formatCurrency(roundToCents(amount));
}

/** Sama senttipyöristys kuin otsikon hinnassa. null = kelvoton luku. */
export function offerGrossFromVat0(vat0: number, vatPercent: number): number | null {
  if (!Number.isFinite(vat0) || !Number.isFinite(vatPercent)) return null;
  const amount = applyVat(vat0, vatPercent);
  return Number.isFinite(amount) ? roundToCents(amount) : null;
}

/**
 * Sis. ALV -otsikoiden summa. Jokainen rivi pyöristetään ensin, kuten tuloste.
 * null, jos jokin hinnoiteltu rivi on kelvoton.
 */
export function sumOfferHeadingGross(record: CalculationRecord): number | null {
  let sum = 0;
  for (const line of ensureStructureLines(record)) {
    if (line.quantity === 0) continue;
    if (!Number.isFinite(line.quantity)) return null;
    const gross = offerGrossFromVat0(lineTotalVat0(line), line.vatPercent);
    if (gross == null) return null;
    sum += gross;
  }
  return roundToCents(sum);
}

/** Listahintojen bruttosumma samalla pyöristyksellä. null = kelvoton rivi. */
export function sumOfferListGross(record: CalculationRecord): number | null {
  let sum = 0;
  for (const line of ensureStructureLines(record)) {
    if (line.quantity === 0) continue;
    if (!Number.isFinite(line.quantity)) return null;
    const gross = offerGrossFromVat0(lineListPriceVat0(line), line.vatPercent);
    if (gross == null) return null;
    sum += gross;
  }
  return roundToCents(sum);
}

/** Ainoa paikka varoitustekstille. Rivin nimeä ei muotoilla uudelleen. */
export function invalidOfferPriceWarning(lineName: string): string {
  return `Tarjouksen rivillä ${lineName} on virheellinen hinta. Korjaa hinta ennen tulostusta.`;
}

/** Täsmälleen yksi päivä on yksikkö, muut monikko. */
export function formatOfferWorkDuration(days: number): string {
  const unit = days === 1 ? 'työpäivä' : 'työpäivää';
  return `Työn arvioitu kesto ${days} ${unit}`;
}

/**
 * Rivin yksikköhinta tai rivisumma ei ole tulostettava luku.
 * Määrä tasan 0 ei ole virhe: rivi jätetään taulukosta pois.
 * Määrä NaN/Infinity on virhe, koska rivisumma painuisi muuten nollaksi.
 */
export function lineOfferPriceInvalid(line: StructureLine, includesVat: boolean): boolean {
  if (line.quantity === 0) return false;
  if (!Number.isFinite(line.quantity)) return true;
  const totalVat0 = lineTotalVat0(line);
  return (
    offerAmount(line.unitPriceVat0, includesVat, line.vatPercent) == null ||
    offerAmount(totalVat0, includesVat, line.vatPercent) == null
  );
}

/** Tarjouksen tulostusesteet. Ei muuta laskelmaa. Tyhjä lista = tarjouksen saa luoda. */
export function offerDocumentProblems(record: CalculationRecord): string[] {
  const customer = customerFromRecord(record);
  const problems: string[] = [];
  for (const line of ensureStructureLines(record)) {
    if (line.quantity === 0) continue;
    if (lineOfferPriceInvalid(line, offerIncludesVat(customer, record.formSnapshot))) {
      problems.push(invalidOfferPriceWarning(line.name));
    }
  }
  return problems;
}

function matchingStructure(line: StructureLine, structures: ProductStructure[]): ProductStructure | undefined {
  return structures.find((item) => item.id === line.structureId);
}

function hasOfferForm(structure: ProductStructure | undefined): structure is ProductStructure {
  return Boolean(structure?.form && Array.isArray(structure.form.fields) && Array.isArray(structure.form.pages));
}

/** Manuaalirivi: ei pohjaa, tai rakennetta / lomaketta ei löydy. */
export function isManualOfferLine(line: StructureLine, structures: ProductStructure[]): boolean {
  if (isManualStructureId(line.structureId)) return true;
  return !hasOfferForm(matchingStructure(line, structures));
}

/**
 * Alv-%-sarake. ALV 0 (myös käänteinen) tulostaa "Alv 0 %".
 * Verollinen summa tulostaa rivin verokannan, myös yksityisellä.
 */
function offerVatLabel(includesVat: boolean, vatPercent: number): string | undefined {
  if (!includesVat) return `Alv ${formatPercent(0)}`;
  if (!Number.isFinite(vatPercent)) return undefined;
  return formatPercent(vatPercent);
}

/**
 * A-hinta. Ilman rivialennusta rivin yksikköhinta.
 * Rivialennus on jo Yht.-summassa, joten A-hinta on rivisumma / määrä.
 * Tarjouksen erillinen Alennus-rivi ei muuta näitä sarakkeita.
 */
function formatOfferUnitPrice(line: StructureLine, includesVat: boolean): string {
  const quantity = line.quantity;
  if (clampDiscountPercent(line.discountPercent) > 0 && Number.isFinite(quantity) && quantity !== 0) {
    return formatOfferMoney(lineTotalVat0(line) / quantity, includesVat, line.vatPercent);
  }
  return formatOfferMoney(line.unitPriceVat0, includesVat, line.vatPercent);
}

function offerHeading(line: StructureLine, includesVat: boolean): OfferHeading | undefined {
  if (line.quantity === 0) return undefined;
  const invalid = lineOfferPriceInvalid(line, includesVat);
  const quantity = Number.isFinite(line.quantity) ? formatQuantity(line.quantity) : '';
  const unit = line.unit?.trim() ?? '';
  const heading: OfferHeading = {
    quantityLabel: [quantity, unit].filter((part) => part.length > 0).join(' '),
    quantity,
    unit,
    unitPrice: invalid ? '' : formatOfferUnitPrice(line, includesVat),
    price: invalid ? '' : formatOfferMoney(lineTotalVat0(line), includesVat, line.vatPercent),
  };
  const vatLabel = offerVatLabel(includesVat, line.vatPercent);
  if (vatLabel) heading.vatLabel = vatLabel;
  return heading;
}

function offerPrintRows(
  line: StructureLine,
  structure: ProductStructure,
  source: OfferDocumentSource,
  reverseVat: boolean,
): PrintRow[] {
  const structureProducts = source.products.filter((product) => productBelongsToStructure(product, line.structureId));
  let context: Record<string, number> = {};
  try {
    context = previewFormContext(
      structure.form,
      line.fieldValues ?? {},
      [],
      structureProducts,
      settingsForStructure(source.settings, structure),
      undefined,
      reverseVat,
      buildCalculationFormulaContext({ travelTimeHoursOneWay: source.record.travelTimeHoursOneWay }),
    );
  } catch {
    context = {};
  }
  const snapshot = lineSpecSnapshot(
    line,
    structure,
    source.products,
    source.settings,
    reverseVat,
    source.record.travelTimeHoursOneWay,
  );
  return printableFields({
    form: structure.form,
    fieldValues: line.fieldValues ?? {},
    context,
    products: source.products,
    snapshot,
    target: 'offer',
  });
}

export function buildOfferRows(source: OfferDocumentSource): OfferRow[] {
  const customer = customerFromRecord(source.record);
  const includesVat = offerIncludesVat(customer, source.record.formSnapshot);
  const lines = ensureStructureLines(source.record).filter((line) => line.quantity !== 0);
  const showDiscount = lines.some((line) => line.discountPercent > 0);
  const rows: OfferRow[] = [];
  for (const line of lines) {
    const description = isManualOfferLine(line, source.structures) ? line.additionalInfo?.trim() ?? '' : '';
    const invalid = lineOfferPriceInvalid(line, includesVat);
    const row: OfferRow = {
      name: line.name,
      quantity: formatQuantity(line.quantity),
      unit: line.unit?.trim() ?? '',
      unitPrice: invalid ? '' : formatOfferMoney(line.unitPriceVat0, includesVat, line.vatPercent),
      vatPercent: formatPercent(includesVat ? line.vatPercent : 0),
      total: invalid ? '' : formatOfferMoney(lineTotalVat0(line), includesVat, line.vatPercent),
    };
    if (showDiscount) row.discountPercent = formatPercent(line.discountPercent);
    if (description) row.description = description;
    rows.push(row);
  }
  return rows;
}

export function buildOfferSections(source: OfferDocumentSource): OfferSection[] {
  const customer = customerFromRecord(source.record);
  const includesVat = offerIncludesVat(customer, source.record.formSnapshot);
  const reverseVat = Boolean(customer.reverseVat);
  const sections: OfferSection[] = [];
  for (const line of ensureStructureLines(source.record)) {
    const heading = offerHeading(line, includesVat);
    if (isManualOfferLine(line, source.structures)) {
      const description = line.additionalInfo?.trim() || undefined;
      if (!heading && !description) continue;
      sections.push({ title: line.name, heading, description, textGroups: [], tableRows: [] });
      continue;
    }
    const structure = matchingStructure(line, source.structures);
    if (!hasOfferForm(structure)) continue;
    const body = buildPrintedBody(offerPrintRows(line, structure, source, reverseVat));
    const extra = source.offerStructureSettings[line.structureId]?.additionalInfoText?.trim() ?? '';
    if (extra) appendPrintedText(body, 'muuta', extra);
    const days = resolveDisplayedWorkDurationDays(line, source.settings.weatherReserveFactor);
    if (days != null && days > 0) {
      const unit = days === 1 ? 'työpäivä' : 'työpäivää';
      body.tableRows.push({ label: 'Työn arvioitu kesto', value: `${days} ${unit}` });
    }
    if (!heading && body.textGroups.length === 0 && body.tableRows.length === 0) continue;
    sections.push({ title: line.name, heading, textGroups: body.textGroups, tableRows: body.tableRows });
  }
  return sections;
}

/**
 * ALV-erittely maksun jälkeen. Yksi verokanta → yksi rivi.
 * Yksityinen käyttää tallennettuja summia. Yrityksen sis. ALV käyttää otsikoiden
 * bruttosummaa, jotta erittely ja Loppusumma ovat samat.
 * Usea verokanta: rivien verottomat osuudet ovat painoja. Yrityksen ALV 0 ja käänteinen ALV: ei rivejä.
 */
export function offerVatSummary(record: CalculationRecord, customer: CustomerInfo): OfferVatSummaryRow[] {
  if (!offerIncludesVat(customer, record.formSnapshot)) return [];
  const businessSis = customer.customerType === 'business';
  const headingGross = businessSis ? sumOfferHeadingGross(record) : null;
  const lines = ensureStructureLines(record);
  const rates: number[] = [];
  const weights = new Map<number, number>();
  for (const line of lines) {
    const rate = Number.isFinite(line.vatPercent) ? line.vatPercent : record.vatPercent;
    if (!weights.has(rate)) rates.push(rate);
    weights.set(rate, (weights.get(rate) ?? 0) + Math.max(0, lineTotalVat0(line)));
  }
  if (rates.length <= 1) {
    const gross = headingGross ?? record.totalPriceVat;
    return [
      {
        vatPercent: rates[0] ?? record.vatPercent,
        net: record.totalPriceVat0,
        vat: headingGross == null ? record.vatAmount : roundToCents(gross - record.totalPriceVat0),
        gross,
      },
    ];
  }
  if (headingGross != null) {
    return rates.map((rate) => {
      const group = lines.filter(
        (line) => (Number.isFinite(line.vatPercent) ? line.vatPercent : record.vatPercent) === rate && line.quantity !== 0,
      );
      const net = roundToCents(group.reduce((sum, line) => sum + Math.max(0, lineTotalVat0(line)), 0));
      const gross = roundToCents(
        group.reduce((sum, line) => sum + (offerGrossFromVat0(lineTotalVat0(line), line.vatPercent) ?? 0), 0),
      );
      return { vatPercent: rate, net, vat: roundToCents(gross - net), gross };
    });
  }
  const weightSum = rates.reduce((sum, rate) => sum + (weights.get(rate) ?? 0), 0);
  if (!(weightSum > 0)) {
    return [
      {
        vatPercent: record.vatPercent,
        net: record.totalPriceVat0,
        vat: record.vatAmount,
        gross: record.totalPriceVat,
      },
    ];
  }
  let netUsed = 0;
  let grossUsed = 0;
  return rates.map((rate, index) => {
    const last = index === rates.length - 1;
    const weight = weights.get(rate) ?? 0;
    const net = last
      ? roundToCents(record.totalPriceVat0 - netUsed)
      : roundToCents((record.totalPriceVat0 * weight) / weightSum);
    const gross = last
      ? roundToCents(record.totalPriceVat - grossUsed)
      : roundToCents(applyVat(net, rate));
    netUsed += net;
    grossUsed += gross;
    return { vatPercent: rate, net, vat: roundToCents(gross - net), gross };
  });
}

/**
 * Allekirjoituslohkon osapuolet. Ei uusia kenttiä: myyjän nimi ja yrityksen nimi
 * tulevat samoista yritystiedoista kuin Myyjä-lohko. Titteliä ei ole asetuksissa, joten sitä ei tulosteta.
 * Puhelin ja sähköposti jäävät Myyjä-lohkoon.
 */
export function offerSignatureParties(company: CompanyProfile, customerName: string | undefined): {
  sellerLines: string[];
  customerName: string;
} {
  const sellerLines = [company.sellerName, company.companyName]
    .map((line) => (typeof line === 'string' ? line.trim() : ''))
    .filter((line) => line.length > 0);
  return { sellerLines, customerName: customerName?.trim() ?? '' };
}

/** Myyjän nimi, puhelin ja sähköposti. Oma numero/sähköposti voittaa yrityksen. Tyhjä lista = lohko pois. */
export function sellerContactLines(company: CompanyProfile): string[] {
  const name = company.sellerName?.trim() ?? '';
  const phone = company.sellerPhone?.trim() || company.phone?.trim() || '';
  const email = company.sellerEmail?.trim() || company.email?.trim() || '';
  return [name, phone ? `Puh. ${phone}` : '', email].filter((line) => line.length > 0);
}
