import { clampDiscountPercent, type DiscountableTotals } from '@/src/core/calculation/discount';
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
  const quantity = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0;
  return line.unitPriceVat0 * quantity;
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
    line.contractPriceVat0,
    line.materialsVat0,
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
  const priced = lines.map(withDerivedLinePricing);
  const contractPriceVat0 = priced.reduce((sum, line) => sum + line.contractPriceVat0, 0);
  const materialsVat0 = priced.reduce((sum, line) => sum + line.materialsVat0, 0);
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

  const vatAmount = reverseVat ? 0 : applyVat(totalPriceVat0, vatPercent) - totalPriceVat0;
  const totalPriceVat = reverseVat ? totalPriceVat0 : totalPriceVat0 + vatAmount;
  const totalPriceVatBeforeDiscount = reverseVat
    ? totalPriceVat0BeforeDiscount
    : applyVat(totalPriceVat0BeforeDiscount, vatPercent);
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
