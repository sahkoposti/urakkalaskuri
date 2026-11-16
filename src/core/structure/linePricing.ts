import { clampDiscountPercent, type DiscountableTotals } from '@/src/core/calculation/discount';
import { structureLineQuantityIsZero } from '@/src/core/materials/structureLineQuantity';
import { scaleByLineQuantity } from '@/src/core/structure/lineQuantityScale';
import type { StructureLine } from '@/src/core/structure/types';
import { roundToCents } from '@/src/core/utils/formatters';
import { applyVat, removeVat } from '@/src/core/utils/priceDisplay';

/** Kortin hinta/materiaalit: oletus ALV:llinen. */
export function linePricesIncludeVat(line: Pick<StructureLine, 'pricesIncludeVat'>): boolean {
  return line.pricesIncludeVat !== false;
}

export function toCardAmount(vat0: number, includeVat: boolean, vatPercent: number): number {
  return roundToCents(includeVat ? applyVat(vat0, vatPercent) : vat0);
}

export function fromCardAmount(entered: number, includeVat: boolean, vatPercent: number): number {
  return roundToCents(includeVat ? removeVat(entered, vatPercent) : entered);
}

export function lineListPriceVat0(line: Pick<StructureLine, 'unitPriceVat0' | 'quantity'>): number {
  return scaleByLineQuantity(line.unitPriceVat0, line.quantity);
}

export function lineTotalVat0(
  line: Pick<StructureLine, 'unitPriceVat0' | 'quantity' | 'discountPercent'>,
): number {
  const discount = clampDiscountPercent(line.discountPercent);
  return lineListPriceVat0(line) * (1 - discount / 100);
}

export function lineCommissionEur(
  lineTotal: number,
  commissionPercent: number,
): number {
  if (!(lineTotal > 0) || !(commissionPercent > 0)) return 0;
  return lineTotal * (commissionPercent / 100);
}

export function lineMarginEur(
  lineTotal: number,
  contractPriceVat0: number,
  materialsVat0: number,
  commissionEur: number,
): number {
  return lineTotal - contractPriceVat0 - materialsVat0 - commissionEur;
}

export function lineMarginPercent(marginEur: number, lineTotal: number): number {
  if (!(lineTotal > 0)) return 0;
  return (marginEur / lineTotal) * 100;
}

/** Päivittää rivin lasketut kate- ja palkkiokentät sekä yhteensä-riippuvaiset luvut. */
export function withDerivedLinePricing(line: StructureLine): StructureLine {
  const total = lineTotalVat0(line);
  const commissionEur = lineCommissionEur(total, line.commissionPercent);
  const marginEur = lineMarginEur(
    total,
    scaleByLineQuantity(line.contractPriceVat0, line.quantity),
    scaleByLineQuantity(line.materialsVat0, line.quantity),
    commissionEur,
  );
  return {
    ...line,
    discountPercent: clampDiscountPercent(line.discountPercent),
    commissionEur,
    marginEur,
    marginPercent: lineMarginPercent(marginEur, total),
  };
}

export function lineDiscountEur(line: StructureLine): number {
  return Math.max(0, lineListPriceVat0(line) - lineTotalVat0(line));
}

export type StructureTotals = DiscountableTotals & {
  marginPercent: number;
};

export function aggregateStructureLines(
  lines: StructureLine[],
  vatPercent: number,
  reverseVat: boolean,
): StructureTotals {
  const priced = lines
    .filter((line) => !structureLineQuantityIsZero(line))
    .map(withDerivedLinePricing);
  const contractPriceVat0 = priced.reduce(
    (sum, line) => sum + scaleByLineQuantity(line.contractPriceVat0, line.quantity),
    0,
  );
  const materialsVat0 = priced.reduce(
    (sum, line) => sum + scaleByLineQuantity(line.materialsVat0, line.quantity),
    0,
  );
  const marginEur = priced.reduce((sum, line) => sum + line.marginEur, 0);
  const commissionEur = priced.reduce((sum, line) => sum + line.commissionEur, 0);
  const totalPriceVat0 = priced.reduce((sum, line) => sum + lineTotalVat0(line), 0);
  const totalPriceVat0BeforeDiscount = priced.reduce(
    (sum, line) => sum + lineListPriceVat0(line),
    0,
  );
  const discountEur = Math.max(0, totalPriceVat0BeforeDiscount - totalPriceVat0);
  const discountPercent =
    totalPriceVat0BeforeDiscount > 0 ? (discountEur / totalPriceVat0BeforeDiscount) * 100 : 0;

  let vatAmount = 0;
  let totalPriceVat = totalPriceVat0;
  let totalPriceVatBeforeDiscount = totalPriceVat0BeforeDiscount;
  if (!reverseVat) {
    let gross = 0;
    let listGross = 0;
    for (const line of priced) {
      const rate = Number.isFinite(line.vatPercent) ? line.vatPercent : vatPercent;
      gross += roundToCents(applyVat(lineTotalVat0(line), rate));
      listGross += roundToCents(applyVat(lineListPriceVat0(line), rate));
    }
    totalPriceVat = roundToCents(gross);
    totalPriceVatBeforeDiscount = roundToCents(listGross);
    vatAmount = roundToCents(totalPriceVat - totalPriceVat0);
  }
  const marginPercent =
    totalPriceVat0 > 0 ? (marginEur / totalPriceVat0) * 100 : 0;

  return {
    contractPriceVat0,
    materialsVat0,
    marginEur,
    commissionEur,
    totalPriceVat0,
    vatAmount,
    totalPriceVat,
    discountPercent,
    discountEur,
    totalPriceVat0BeforeDiscount,
    totalPriceVatBeforeDiscount,
    marginPercent,
  };
}
