import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import type { CompanyProfile } from '@/src/core/company/types';
import { buildCalculationFormulaContext } from '@/src/core/form/calculationFormulaContext';
import type { AppSettings, CalculationRecord, CustomerInfo, Product, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { lineTotalVat0 } from '@/src/core/structure/linePricing';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
import type { ProductStructure } from '@/src/core/structure/types';
import { isManualStructureId } from '@/src/core/structure/types';
import { resolveDisplayedWorkDurationDays } from '@/src/core/structure/workDurationDisplay';
import { formatCurrency, formatDebugDecimal, formatPercent, roundToCents } from '@/src/core/utils/formatters';
import { applyVat, customerSeesVatInclusive } from '@/src/core/utils/priceDisplay';

import { lineSpecSnapshot } from './offerPageSpecs';
import { groupPrintRows, printableFields, type PrintRow } from './printableFields';
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

export type OfferSection = {
  title: string;
  /** "Osa-alueet: a, b" */
  areas?: string;
  phases: string[];
  notes: string[];
  facts: string[];
  paints: string[];
  workDuration?: string;
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
  if (!Number.isFinite(value)) return '';
  return formatDebugDecimal(value);
}

function formatOfferMoney(vat0: number, includesVat: boolean, vatPercent: number): string {
  const amount = includesVat ? applyVat(vat0, vatPercent) : vat0;
  return formatCurrency(roundToCents(amount));
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

function phrase(row: PrintRow): string {
  const label = row.label.trim();
  const value = row.value.trim();
  if (!label) return value;
  if (!value || value === 'Kyllä' || value === label) return label;
  return `${label} ${value}`;
}

function valueHasUnit(value: string, unit: string): boolean {
  return value === unit || value.endsWith(` ${unit}`);
}

function tietoLine(row: PrintRow): string {
  const label = row.label.trim();
  let value = row.value.trim();
  const unit = row.unit?.trim();
  if (unit && value && !valueHasUnit(value, unit)) value = `${value} ${unit}`;
  if (!label) return value;
  return `${label} ${value}`.trim();
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
  const includesVat = customerSeesVatInclusive(customerFromRecord(source.record));
  const lines = ensureStructureLines(source.record);
  const showDiscount = lines.some((line) => line.discountPercent > 0);
  return lines.map((line) => {
    const description = isManualOfferLine(line, source.structures) ? line.additionalInfo?.trim() ?? '' : '';
    const row: OfferRow = {
      name: line.name,
      quantity: formatQuantity(line.quantity),
      unit: line.unit?.trim() ?? '',
      unitPrice: formatOfferMoney(line.unitPriceVat0, includesVat, line.vatPercent),
      vatPercent: formatPercent(includesVat ? line.vatPercent : 0),
      total: formatOfferMoney(lineTotalVat0(line), includesVat, line.vatPercent),
    };
    if (showDiscount) row.discountPercent = formatPercent(line.discountPercent);
    if (description) row.description = description;
    return row;
  });
}

export function buildOfferSections(source: OfferDocumentSource): OfferSection[] {
  const reverseVat = Boolean(customerFromRecord(source.record).reverseVat);
  const sections: OfferSection[] = [];
  for (const line of ensureStructureLines(source.record)) {
    const structure = matchingStructure(line, source.structures);
    if (!hasOfferForm(structure) || isManualOfferLine(line, source.structures)) continue;
    const grouped = groupPrintRows(offerPrintRows(line, structure, source, reverseVat));
    const notes = grouped.muuta.map(phrase).filter((item) => item.length > 0);
    const extra = source.offerStructureSettings[line.structureId]?.additionalInfoText?.trim() ?? '';
    if (extra) notes.push(extra);
    const areas = grouped.osa_alueet.map(phrase).filter((item) => item.length > 0);
    const days = resolveDisplayedWorkDurationDays(line, source.settings.weatherReserveFactor);
    const section: OfferSection = {
      title: line.name,
      phases: grouped.tyovaiheet.map(phrase).filter((item) => item.length > 0),
      notes,
      facts: grouped.tieto.map(tietoLine).filter((item) => item.length > 0),
      paints: grouped.maali.map((row) => row.value.trim()).filter((item) => item.length > 0),
    };
    if (areas.length > 0) section.areas = `Osa-alueet: ${areas.join(', ')}`;
    if (days != null && days > 0) section.workDuration = `Työn arvioitu kesto ${days} työpäivää`;
    sections.push(section);
  }
  return sections;
}

/**
 * ALV-erittely maksun jälkeen. Yksi verokanta → yksi rivi tallennetuista summista.
 * Usea verokanta: rivien verottomat osuudet ovat vain painoja; netot ja bruttot
 * summataan tallennettuun laskelmaan. Yritys ja käänteinen ALV: ei rivejä.
 */
export function offerVatSummary(record: CalculationRecord, customer: CustomerInfo): OfferVatSummaryRow[] {
  if (!customerSeesVatInclusive(customer)) return [];
  const lines = ensureStructureLines(record);
  const rates: number[] = [];
  const weights = new Map<number, number>();
  for (const line of lines) {
    const rate = Number.isFinite(line.vatPercent) ? line.vatPercent : record.vatPercent;
    if (!weights.has(rate)) rates.push(rate);
    weights.set(rate, (weights.get(rate) ?? 0) + Math.max(0, lineTotalVat0(line)));
  }
  if (rates.length <= 1) {
    return [
      {
        vatPercent: rates[0] ?? record.vatPercent,
        net: record.totalPriceVat0,
        vat: record.vatAmount,
        gross: record.totalPriceVat,
      },
    ];
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

/** Myyjän nimi, puhelin ja sähköposti. Oma numero/sähköposti voittaa yrityksen. Tyhjä lista = lohko pois. */
export function sellerContactLines(company: CompanyProfile): string[] {
  const name = company.sellerName?.trim() ?? '';
  const phone = company.sellerPhone?.trim() || company.phone?.trim() || '';
  const email = company.sellerEmail?.trim() || company.email?.trim() || '';
  return [name, phone ? `Puh. ${phone}` : '', email].filter((line) => line.length > 0);
}
