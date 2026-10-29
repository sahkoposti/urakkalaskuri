import type { CalculationRecord, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { patchStructureLine } from '@/src/core/structure/applyFormToLine';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { aggregateStructureLines } from '@/src/core/structure/linePricing';
import { roundToCents } from '@/src/core/utils/formatters';

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Tekijöiden urakka (alv0) = rivin contractPriceVat0 (lomakkeesta tai käsin kirjattu). */
export function effectiveContractVat0(line: Pick<StructureLine, 'contractPriceVat0'>): number {
  return positive(line.contractPriceVat0) ? line.contractPriceVat0 : 0;
}

/** Rivit, joille urakka pitää kirjata käsin ennen urakkakorttia (lomaketta ei käytetty / urakka 0). */
export function linesNeedingManualContract(record: CalculationRecord): StructureLine[] {
  return ensureStructureLines(record).filter((line) => effectiveContractVat0(line) <= 0);
}

/**
 * Käsin kirjattu urakka KORVAA contractPriceVat0:n (Eemil 29.10.2026 #7).
 * Sama polku kuin rivikortin käsimuokkaus (patchStructureLine): merkitsee 'contractPrice'-ohituksen,
 * joten lomakkeen uudelleenlaskenta ei ylikirjoita sitä, ja kate lasketaan uudelleen.
 * Vain positiiviset luvut; muut rivit ennallaan.
 */
export function withManualContractPrices(
  lines: StructureLine[],
  manualByLineId: Record<string, number | null | undefined>,
): StructureLine[] {
  return lines.map((line) => {
    const value = manualByLineId[line.id];
    return positive(value) ? patchStructureLine(line, { contractPriceVat0: roundToCents(value) }) : line;
  });
}

/** Laskelma, jonka riveille urakat on kirjattu; laskelman urakka, kate ja kate-% lasketaan uudelleen. */
export function recordWithManualContractPrices(
  record: CalculationRecord,
  manualByLineId: Record<string, number | null | undefined>,
): CalculationRecord {
  const structureLines = withManualContractPrices(ensureStructureLines(record), manualByLineId);
  const totals = aggregateStructureLines(
    structureLines,
    record.vatPercent,
    Boolean(customerFromRecord(record).reverseVat),
  );
  return {
    ...record,
    structureLines,
    contractPriceVat0: roundToCents(totals.contractPriceVat0),
    marginEur: roundToCents(totals.marginEur),
    marginPercent: totals.marginPercent,
  };
}

/** Dialogin syötteet → summat. Virhe, jos jokin rivi ei ole positiivinen luku (pilkku sallittu). */
export function parseManualContractInputs(
  inputs: Record<string, string>,
): { ok: true; values: Record<string, number> } | { ok: false; invalidLineIds: string[] } {
  const values: Record<string, number> = {};
  const invalidLineIds: string[] = [];
  for (const [lineId, raw] of Object.entries(inputs)) {
    const n = Number(raw.trim().replace(/\s/g, '').replace(',', '.'));
    if (raw.trim() !== '' && Number.isFinite(n) && n > 0) values[lineId] = roundToCents(n);
    else invalidLineIds.push(lineId);
  }
  return invalidLineIds.length ? { ok: false, invalidLineIds } : { ok: true, values };
}
