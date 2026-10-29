import type { CompanyProfile } from '@/src/core/company/types';
import type { AppSettings, CalculationRecord, Product } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import type { ProductStructure } from '@/src/core/structure/types';
import { resolveDisplayedWorkDurationDays } from '@/src/core/structure/workDurationDisplay';
import { estimateWorkDurationDays, formatCurrency } from '@/src/core/utils/formatters';

import { buildFooter, customerHeaderLines, type PdfFooter, type PriceRow } from './buildPdfContext';
import { lineSpecSnapshot, specCardsFromSnapshot, type SpecCard } from './offerPageSpecs';
import { specGridLayout, type SpecGridLayout } from './specGridLayout';
import { effectiveContractVat0 } from './manualContract';
import { formatFinnishDate } from './validUntil';

export { effectiveContractVat0, linesNeedingManualContract, withManualContractPrices } from './manualContract';

/**
 * Urakkakortti (suunnitelma §2, Eemil 29.10.2026 #3, #6). Maalareille.
 * EI: asiakashinta, ALV, kate, palkkio, materiaalihinnat, KTV, voimassaolo, tarjousnumero, tarjouksen lisätiedot.
 */

export type UrakkakorttiMaterialRow = { product: string; quantity: string; unit: string };

export type UrakkakorttiContext = {
  kind: 'urakkakortti';
  customerLines: string[];
  offerInfo: PriceRow[];
  /** Rivikohtaiset urakat (Eemil #3); yhteensä-rivi kun rivejä > 1. Ainoat €-arvot. */
  contractRows: PriceRow[];
  infoRows: PriceRow[];
  specGrid: SpecGridLayout;
  materials: UrakkakorttiMaterialRow[];
  customerNotes: string;
  footer: PdfFooter;
};

export type BuildUrakkakorttiInput = {
  record: CalculationRecord;
  company: CompanyProfile;
  structures: ProductStructure[];
  products: Product[];
  settings: AppSettings;
  generatedAt: Date;
};

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** €-arvoiset speksirivit pois (voivat paljastaa hintoja, esim. Hinnoittelu-sivu). */
function withoutEuroRows(card: SpecCard): SpecCard {
  return { ...card, rows: card.rows.filter((row) => !row.value.includes('€')) };
}

export function urakkakorttiSpecCards(input: BuildUrakkakorttiInput): SpecCard[] {
  const customer = customerFromRecord(input.record);
  const lines = ensureStructureLines(input.record);
  const perLine = lines.map((line) => {
    const structure = input.structures.find((item) => item.id === line.structureId);
    const customerPageIds = new Set(
      (structure?.form.pages ?? []).filter((page) => page.system === 'customer').map((page) => page.id),
    );
    const snapshot = lineSpecSnapshot(
      line,
      structure,
      input.products,
      input.settings,
      Boolean(customer.reverseVat),
      input.record.travelTimeHoursOneWay,
    );
    const cards = specCardsFromSnapshot(snapshot, structure?.form)
      .filter((card) => card.pageId == null || !customerPageIds.has(card.pageId))
      .map(withoutEuroRows)
      .filter((card) => card.rows.length > 0);
    return { line, cards };
  });
  const many = perLine.filter((item) => item.cards.length > 0).length > 1;
  return perLine.flatMap(({ line, cards }) =>
    many ? cards.map((card) => ({ ...card, title: `${line.name}: ${card.title}` })) : cards,
  );
}

/**
 * Materiaalit: tuote | määrä | yksikkö, ei hintoja. Lähde nyt: tallennetut materiaalirivit (record.lines).
 * Nykyinen kokoaja tallentaa lines: [] → osio jää pois, kunnes materiaalimäärien tallennus Yhteenvedossa on päätetty.
 */
export function urakkakorttiMaterials(record: CalculationRecord): UrakkakorttiMaterialRow[] {
  return record.lines
    .filter((line) => line.productName.trim() && Number.isFinite(line.quantity) && line.quantity > 0)
    .map((line) => ({
      product: line.productName.trim(),
      quantity: new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 }).format(line.quantity),
      unit: line.unit,
    }));
}

export function buildUrakkakorttiContext(input: BuildUrakkakorttiInput): UrakkakorttiContext {
  const { record, settings } = input;
  const customer = customerFromRecord(record);
  const lines = ensureStructureLines(record);
  const contractRows: PriceRow[] = lines.map((line) => ({
    label: lines.length > 1 ? `Tekijöiden urakka: ${line.name}` : 'Tekijöiden urakka (alv0)',
    value: formatCurrency(effectiveContractVat0(line)),
  }));
  if (lines.length > 1) {
    contractRows.push({
      label: 'Tekijöiden urakka yhteensä (alv0)',
      value: formatCurrency(lines.reduce((sum, line) => sum + effectiveContractVat0(line), 0)),
      emphasis: true,
    });
  }
  const duration =
    lines.length === 1
      ? resolveDisplayedWorkDurationDays(lines[0], settings.weatherReserveFactor)
      : estimateWorkDurationDays(record.workDurationDays, settings.weatherReserveFactor);
  const infoRows: PriceRow[] = [
    ...(duration ? [{ label: 'Työn arvioitu kesto', value: `${duration} pv` }] : []),
    ...(positive(record.crewSize) ? [{ label: 'Työryhmän koko', value: `${record.crewSize} hlö` }] : []),
    ...(record.deliveryScheduleText?.trim()
      ? [{ label: 'Toimitusajankohta', value: record.deliveryScheduleText.trim() }]
      : []),
  ];
  return {
    kind: 'urakkakortti',
    // Kohde: nimi + osoite + puhelin (ei sähköpostia tarvita maalarille, mutta ei haitta).
    customerLines: customerHeaderLines({ ...customer, email: undefined }),
    offerInfo: [{ label: 'Päiväys', value: formatFinnishDate(input.generatedAt) }],
    contractRows,
    infoRows,
    specGrid: specGridLayout(urakkakorttiSpecCards(input)),
    materials: urakkakorttiMaterials(record),
    customerNotes: customer.notes?.trim() ?? '',
    footer: buildFooter(input.company),
  };
}
