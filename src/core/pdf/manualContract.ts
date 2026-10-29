import type { CalculationRecord, StructureLine } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { roundToCents } from '@/src/core/utils/formatters';

const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** Tekijöiden urakka: lomakkeen contractPriceVat0, muuten käsin kirjattu summa. */
export function effectiveContractVat0(line: Pick<StructureLine, 'contractPriceVat0' | 'manualContractPriceVat0'>): number {
  if (positive(line.contractPriceVat0)) return line.contractPriceVat0;
  return positive(line.manualContractPriceVat0) ? line.manualContractPriceVat0 : 0;
}

/** Rivit, joille urakka pitää kirjata käsin ennen urakkakorttia (lomaketta ei käytetty / urakka 0). */
export function linesNeedingManualContract(record: CalculationRecord): StructureLine[] {
  return ensureStructureLines(record).filter((line) => effectiveContractVat0(line) <= 0);
}

/** Lisää käsin kirjatut urakat riveille (vain positiiviset luvut; muut rivit ennallaan). */
export function withManualContractPrices(
  lines: StructureLine[],
  manualByLineId: Record<string, number | null | undefined>,
): StructureLine[] {
  return lines.map((line) => {
    const value = manualByLineId[line.id];
    return positive(value) ? { ...line, manualContractPriceVat0: roundToCents(value) } : line;
  });
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
