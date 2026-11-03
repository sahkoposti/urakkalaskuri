import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import { buildCalculationFormulaContext } from '@/src/core/form/calculationFormulaContext';
import type { AppSettings, CalculationRecord, Product, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
import type { ProductStructure } from '@/src/core/structure/types';
import { isManualStructureId } from '@/src/core/structure/types';

import { lineSpecSnapshot } from './offerPageSpecs';
import { printableFields, type PrintRow } from './printableFields';
import { buildPrintedBody, type PrintedTableRow, type PrintedTextGroup } from './printedSection';

/**
 * Urakkakortin tulostusosio (P4). Teksti- ja taulukko-osat ovat samat kuin tarjouksessa.
 * Kesto ei ole kortin kenttä: se jää info-riveihin.
 */
export type UrakkakorttiSection = {
  title: string;
  textGroups: PrintedTextGroup[];
  tableRows: PrintedTableRow[];
};

export type UrakkakorttiSectionSource = {
  record: CalculationRecord;
  structures: ProductStructure[];
  products: Product[];
  settings: AppSettings;
};

function isPlainPrintObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fieldDeclaresPrint(field: { print?: unknown } | null | undefined): boolean {
  if (!field || typeof field !== 'object') return false;
  if (!Object.prototype.hasOwnProperty.call(field, 'print')) return false;
  return isPlainPrintObject(field.print);
}

/**
 * Tulostustila, kun rivin lomakkeella on vähintään yksi kenttä, jonka `print` on objekti
 * (myös `{}`). Manuaalirivi ja pohja ilman print-objektia jäävät T9-kortteihin.
 */
export function lineUsesUrakkakorttiPrint(line: StructureLine, structures: ProductStructure[]): boolean {
  if (isManualStructureId(line.structureId)) return false;
  const structure = structures.find((item) => item.id === line.structureId);
  const fields = structure?.form?.fields;
  if (!Array.isArray(fields)) return false;
  return fields.some((field) => fieldDeclaresPrint(field));
}

/** Turvaverkko: €-rivi ei päädy kortille, vaikka resolveri päästäisi sen läpi. */
export function isEuroPrintRow(row: PrintRow): boolean {
  return row.unit === '€' || (typeof row.value === 'string' && row.value.includes('€'));
}

export function sectionFromPrintRows(
  title: string,
  rows: PrintRow[],
  options?: { includePaintQuantity?: boolean },
): UrakkakorttiSection {
  const body = buildPrintedBody(
    rows.filter((row) => row && !isEuroPrintRow(row)),
    { includePaintQuantity: options?.includePaintQuantity !== false },
  );
  return { title, textGroups: body.textGroups, tableRows: body.tableRows };
}

function urakkakorttiPrintRows(
  line: StructureLine,
  structure: ProductStructure,
  source: UrakkakorttiSectionSource,
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
    target: 'urakkakortti',
  }).filter((row) => !isEuroPrintRow(row));
}

/** Print-tilan rivit `ensureStructureLines`-järjestyksessä. Vanhat rivit eivät tuota osiota. */
export function buildUrakkakorttiSections(
  source: UrakkakorttiSectionSource,
  options?: { omitPaintQuantityLineIds?: ReadonlySet<string> },
): UrakkakorttiSection[] {
  const reverseVat = Boolean(customerFromRecord(source.record).reverseVat);
  const sections: UrakkakorttiSection[] = [];
  for (const line of ensureStructureLines(source.record)) {
    if (!lineUsesUrakkakorttiPrint(line, source.structures)) continue;
    const structure = source.structures.find((item) => item.id === line.structureId);
    if (!structure?.form) continue;
    const includePaintQuantity = !options?.omitPaintQuantityLineIds?.has(line.id);
    sections.push(
      sectionFromPrintRows(line.name, urakkakorttiPrintRows(line, structure, source, reverseVat), {
        includePaintQuantity,
      }),
    );
  }
  return sections;
}
