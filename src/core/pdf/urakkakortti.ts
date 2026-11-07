import type { CompanyProfile } from '@/src/core/company/types';
import type { FormDefinition } from '@/src/core/form/types';
import { effectiveMaterialQuantities, formatQuantity } from '@/src/core/materials/materialQuantities';
import type { AppSettings, CalculationRecord, MaterialQuantityRow, Product } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import type { ProductStructure } from '@/src/core/structure/types';
import { resolveDisplayedWorkDurationDays } from '@/src/core/structure/workDurationDisplay';
import { estimateWorkDurationDays, formatCurrency, roundToCents } from '@/src/core/utils/formatters';

import { buildFooter, customerHeaderLines, type PdfFooter, type PriceRow } from './buildPdfContext';
import {
  alihankkijaLineAmount,
  assertPrintableEmployeeContracts,
  cardHeaderPrices,
  effectiveHuomioitavaa,
  readUrakkakorttiHidePrices,
  readUrakkakorttiMode,
  readUrakkakorttiRivihinnat,
  type UrakkakorttiMode,
} from './urakkakorttiCard';
import { lineSpecSnapshot, specCardsFromSnapshot, type SpecCard } from './offerPageSpecs';
import { documentSiteAddress } from './siteAddress';
import { firstStructureLisatiedot } from './structureExtraText';
import { specGridLayout, type SpecGridLayout } from './specGridLayout';
import { buildUrakkakorttiSections, lineUsesUrakkakorttiPrint, type UrakkakorttiSection } from './urakkakorttiSections';
import type { OfferStructureSettings } from './types';
import { formatFinnishDate } from './validUntil';

export { effectiveContractVat0, linesNeedingManualContract, withManualContractPrices } from './manualContract';
export type { UrakkakorttiSection } from './urakkakorttiSections';

/**
 * Urakkakortti (suunnitelma §2, Eemil 29.10.2026 #3, #6). Maalareille.
 * EI: asiakashinta, ALV, kate, palkkio, materiaalihinnat, KTV, voimassaolo, tarjousnumero, tarjouksen lisätiedot.
 */

export type UrakkakorttiMaterialRow = {
  product: string;
  quantity: string;
  unit: string;
  /** Sävy tuotteen alla. Tuoterivi on otsikko, kun sillä on sävyjä. */
  shade?: boolean;
  shadeHeader?: boolean;
};

export type UrakkakorttiContext = {
  kind: 'urakkakortti';
  customerLines: string[];
  offerInfo: PriceRow[];
  /** Usean rivin erittely. Yhden rivin summa on vain otsikossa, ei tässä uudelleen. */
  contractRows: PriceRow[];
  infoRows: PriceRow[];
  specGrid: SpecGridLayout;
  /** Print-tilan rivit. Tyhjä, kun laskelma on pelkkää vanhaa pohjaa. */
  sections: UrakkakorttiSection[];
  materials: UrakkakorttiMaterialRow[];
  /** Ensimmäisen tuoterakenteen lisätieto rakenteiden jälkeen. Tyhjä = osio pois. */
  structureLisatiedot: string;
  /** Asiakkaan lisätietojen lähde (`customer.notes`). Ei tulosteta otsikolla kahteen kertaan. */
  customerNotes: string;
  /** Huomioitavaa-osion teksti. Tyhjä = osiota ei tulosteta. */
  huomioitavaa: string;
  mode: UrakkakorttiMode;
  /** Kortin otsikko: "Urakkakortti: Alihankkija" tai "Urakkakortti: Työntekijä". */
  modeLabel: string;
  /**
   * Otsikon alihankkijan summa. null, kun hintoja ei näytetä.
   * Sama luku tulostetaan vain kerran, ei taulukossa uudelleen.
   */
  contractSum: string | null;
  /** Otsikon työntekijän summa. null, kun kerroin puuttuu tai on kelvoton tai hinnat on piilotettu. */
  employeeSum: string | null;
  footer: PdfFooter;
};

export type BuildUrakkakorttiInput = {
  record: CalculationRecord;
  company: CompanyProfile;
  structures: ProductStructure[];
  products: Product[];
  settings: AppSettings;
  generatedAt: Date;
  /**
   * Yritysasetuksen Sivukulukerroin. Käyttökelpoinen vain kun 1 < kerroin <= 3.
   * Puuttuva tai kelvoton jättää työntekijän summan pois. Oletusta 1,5 ei keksitä kelvottoman tilalle.
   */
  sivukulukerroin?: number;
  /** Rakenteen Muuta-teksti. Yrityksen Lisätiedot-ehtoja ei välitetä kortille. */
  offerStructureSettings?: Record<string, OfferStructureSettings | undefined>;
};

/** €-arvoiset speksirivit pois (voivat paljastaa hintoja, esim. Hinnoittelu-sivu). */
function withoutEuroRows(card: SpecCard): SpecCard {
  return { ...card, rows: card.rows.filter((row) => !row.value.includes('€')) };
}

export function urakkakorttiSpecCards(input: BuildUrakkakorttiInput): SpecCard[] {
  const customer = customerFromRecord(input.record);
  // Print-pohja piirretään osioina. Vanha pohja pysyy T9-kortteina (printableFields pudottaa "–"-rivit).
  const lines = ensureStructureLines(input.record).filter(
    (line) => !lineUsesUrakkakorttiPrint(line, input.structures),
  );
  const perLine = lines.map((line) => {
    const structure = input.structures.find((item) => item.id === line.structureId);
    const customerPageIds = new Set(
      (structure?.form?.pages ?? []).filter((page) => page.system === 'customer').map((page) => page.id),
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

function lineForm(input: BuildUrakkakorttiInput, structureId: string): FormDefinition | undefined {
  return input.structures.find((item) => item.id === structureId)?.form;
}

function rowHasEuro(row: MaterialQuantityRow): boolean {
  return (
    row.productName.includes('€') ||
    Boolean(row.unit?.includes('€')) ||
    Boolean(row.shades?.some((shade) => shade.name.includes('€') || shade.unit?.includes('€')))
  );
}

function rowPrintable(row: MaterialQuantityRow): boolean {
  if (!row.productName.trim() || rowHasEuro(row)) return false;
  const shades = row.shades ?? [];
  if (shades.some((shade) => shade.name.trim() && shade.quantity > 0)) return true;
  return Number.isFinite(row.quantity) && row.quantity > 0;
}

/**
 * Materiaalitaulukko.
 * Ilman `materialQuantities`-avainta jäädään T9-riveihin (`record.lines`): P4 tulostaa
 * `quantityKey`-määrän jo maali-riville, ja olemassa oleva HTML kieltää ylimääräisen Materiaalit-osion.
 * Kun avain on kirjoitettu, taulukko lukee `effectiveMaterialQuantities`. Tyhjä lista ei palaa T9:ään.
 * Useampi rakennerivi: tuotenimen eteen `rivin nimi: `.
 */
function resolveUrakkakorttiMaterialTable(input: BuildUrakkakorttiInput): {
  rows: UrakkakorttiMaterialRow[];
  omitPaintQuantityLineIds: Set<string>;
} {
  const lines = ensureStructureLines(input.record);
  const explicit = lines.some((line) => line.materialQuantities !== undefined);
  if (!explicit) return { rows: urakkakorttiMaterials(input.record), omitPaintQuantityLineIds: new Set() };

  const rows: UrakkakorttiMaterialRow[] = [];
  const omitPaintQuantityLineIds = new Set<string>();
  const prefix = lines.length > 1;
  for (const line of lines) {
    const quantities = effectiveMaterialQuantities(line, lineForm(input, line.structureId), input.products).filter(
      rowPrintable,
    );
    if (quantities.length === 0) continue;
    omitPaintQuantityLineIds.add(line.id);
    for (const row of quantities) {
      const name = row.productName.trim();
      const product = prefix ? `${line.name}: ${name}` : name;
      const shades = (row.shades ?? []).filter(
        (shade) => shade.name.trim() && Number.isFinite(shade.quantity) && shade.quantity > 0,
      );
      if (shades.length === 0) {
        rows.push({
          product,
          quantity: formatQuantity(row.quantity),
          unit: row.unit?.trim() ?? '',
        });
        continue;
      }
      rows.push({ product, quantity: '', unit: '', shadeHeader: true });
      for (const shade of shades) {
        rows.push({
          product: shade.name.trim(),
          quantity: formatQuantity(shade.quantity),
          unit: shade.unit?.trim() ?? '',
          shade: true,
        });
      }
    }
  }
  return { rows, omitPaintQuantityLineIds };
}

export function buildUrakkakorttiContext(input: BuildUrakkakorttiInput): UrakkakorttiContext {
  const { record, settings } = input;
  const customer = customerFromRecord(record);
  const lines = ensureStructureLines(record);
  const materialTable = resolveUrakkakorttiMaterialTable(input);
  const mode = readUrakkakorttiMode(record.formSnapshot);
  const hidePrices = readUrakkakorttiHidePrices(record.formSnapshot);
  const prices = hidePrices ? null : cardHeaderPrices(record, input.sivukulukerroin);
  if (!hidePrices) assertPrintableEmployeeContracts(record);
  const contractSum = prices ? formatCurrency(prices.alihankkija) : null;
  const employeeSum = prices ? formatCurrency(prices.tyontekija) : null;
  const contractRows: PriceRow[] = [];
  if (prices && lines.length > 1) {
    const overrides = readUrakkakorttiRivihinnat(record.formSnapshot);
    for (const line of lines) {
      contractRows.push({
        label: `Urakka: ${line.name}`,
        value: formatCurrency(roundToCents(alihankkijaLineAmount(line, overrides))),
      });
    }
  }
  const duration =
    lines.length === 1
      ? resolveDisplayedWorkDurationDays(lines[0], settings.weatherReserveFactor)
      : estimateWorkDurationDays(record.workDurationDays, settings.weatherReserveFactor);
  const infoRows: PriceRow[] = [
    ...(duration ? [{ label: 'Työn arvioitu kesto', value: `${duration} pv` }] : []),
    ...(record.deliveryScheduleText?.trim()
      ? [{ label: 'Toimitusajankohta', value: record.deliveryScheduleText.trim() }]
      : []),
  ];
  return {
    kind: 'urakkakortti',
    // Kohde: nimi + osoite + puhelin (ei sähköpostia tarvita maalarille, mutta ei haitta).
    customerLines: customerHeaderLines(
      { ...customer, email: undefined },
      documentSiteAddress(customer, record.formSnapshot),
    ),
    offerInfo: [{ label: 'Päiväys', value: formatFinnishDate(input.generatedAt) }],
    contractRows,
    infoRows,
    specGrid: specGridLayout(urakkakorttiSpecCards(input)),
    sections: buildUrakkakorttiSections(input, {
      omitPaintQuantityLineIds: materialTable.omitPaintQuantityLineIds,
      offerStructureSettings: input.offerStructureSettings,
    }),
    materials: materialTable.rows,
    structureLisatiedot: firstStructureLisatiedot(lines, input.structures)?.text ?? '',
    customerNotes: customer.notes?.trim() ?? '',
    huomioitavaa: effectiveHuomioitavaa(record),
    mode,
    modeLabel: 'Urakkakortti',
    contractSum,
    employeeSum,
    footer: buildFooter(input.company),
  };
}

/**
 * Kortin osiot järjestyksessä. Uusi tekstiosio lisätään tähän listaan;
 * renderöijä käy listan läpi, eikä olemassa olevia osia tarvitse järjestää uudelleen.
 * Kuvat tulevat kortin jälkeen omalle sivulleen (renderUrakkakorttiHtml, attachmentHtml),
 * eivät lohkona tämän listan keskelle.
 */
export type UrakkakorttiBlockKind = 'price' | 'specs' | 'print' | 'lisatiedot' | 'materials' | 'huomio';

export function urakkakorttiBodyBlocks(ctx: UrakkakorttiContext): UrakkakorttiBlockKind[] {
  const blocks: UrakkakorttiBlockKind[] = [];
  if (ctx.contractRows.length > 0 || ctx.infoRows.length > 0) blocks.push('price');
  if (ctx.specGrid.mode !== 'none') blocks.push('specs');
  if (ctx.sections.length > 0) blocks.push('print');
  if (ctx.structureLisatiedot.trim()) blocks.push('lisatiedot');
  if (ctx.materials.length > 0) blocks.push('materials');
  if (ctx.huomioitavaa.trim()) blocks.push('huomio');
  return blocks;
}
