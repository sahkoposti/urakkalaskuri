import type { CalculationRecord, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { structureLineQuantityIsZero } from '@/src/core/materials/structureLineQuantity';
import { patchStructureLine } from '@/src/core/structure/applyFormToLine';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { aggregateStructureLines } from '@/src/core/structure/linePricing';
import { scaleByLineQuantity } from '@/src/core/structure/lineQuantityScale';
import { roundToCents } from '@/src/core/utils/formatters';

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Laskettu urakka (alv0) = rivin contractPriceVat0 × määrä.
 * Puuttuva määrä on yksi kappale. Nolla ja negatiivinen skaalattu summa on 0.
 * Käsin kirjattu korttiyliajo ei kulje tästä.
 */
export function effectiveContractVat0(
  line: Pick<StructureLine, 'contractPriceVat0'> & { quantity?: number },
): number {
  const scaled = scaleByLineQuantity(line.contractPriceVat0, line.quantity);
  return positive(scaled) ? scaled : 0;
}

/** Rivit, joille urakka pitää kirjata käsin ennen urakkakorttia (lomaketta ei käytetty / urakka 0). Määrä 0 ei kysy. */
export function linesNeedingManualContract(record: CalculationRecord): StructureLine[] {
  return ensureStructureLines(record).filter(
    (line) => !structureLineQuantityIsZero(line) && effectiveContractVat0(line) <= 0,
  );
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
