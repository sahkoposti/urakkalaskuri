export const DISCOUNT_PERCENT_KEY = 'alennus_prosentti';
export const DISCOUNT_EUR_KEY = 'alennus_eur';

/** Yhteinen hintarunko form-finishille, alennukselle ja rivikoosteelle. */
export type PriceTotals = {
  contractPriceVat0: number;
  materialsVat0: number;
  marginEur: number;
  commissionEur: number;
  totalPriceVat0: number;
  vatAmount: number;
  totalPriceVat: number;
  discountPercent: number;
  discountEur: number;
  totalPriceVatBeforeDiscount: number;
  totalPriceVat0BeforeDiscount: number;
};

export type DiscountableTotals = PriceTotals;

export function isDiscountPercentKey(key: string | undefined): boolean {
  return key === DISCOUNT_PERCENT_KEY;
}

/** Alennus-% rajataan 0–100. */
export function clampDiscountPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

/**
 * Kaavojen tulos on listahinta. Alennus-% pienentää myyntihintaa;
 * kate on jäännös kustannusten ja palkkion jälkeen.
 */
export function applyDiscountToResult<T extends DiscountableTotals>(
  result: T,
  discountPercentRaw: number,
  reverseVat: boolean,
): T {
  const discountPercent = clampDiscountPercent(discountPercentRaw);
  const totalPriceVatBeforeDiscount = result.totalPriceVat;
  const totalPriceVat0BeforeDiscount = result.totalPriceVat0;

  if (discountPercent <= 0) {
    return {
      ...result,
      discountPercent: 0,
      discountEur: 0,
      totalPriceVatBeforeDiscount,
      totalPriceVat0BeforeDiscount,
    };
  }

  const factor = 1 - discountPercent / 100;
  const totalPriceVat0 = totalPriceVat0BeforeDiscount * factor;
  const totalPriceVat = reverseVat
    ? totalPriceVat0
    : totalPriceVatBeforeDiscount * factor;
  const vatAmount = reverseVat ? 0 : totalPriceVat - totalPriceVat0;
  const commissionEur = result.commissionEur * factor;

  const listParts =
    result.contractPriceVat0 + result.materialsVat0 + result.marginEur + result.commissionEur;
  const identityOnVatIncl =
    Math.abs(listParts - totalPriceVatBeforeDiscount) <=
    Math.abs(listParts - totalPriceVat0BeforeDiscount);
  const listSelling = identityOnVatIncl
    ? totalPriceVatBeforeDiscount
    : totalPriceVat0BeforeDiscount;
  const impliedDirect = listSelling - result.marginEur - result.commissionEur;
  const sellingAfter = identityOnVatIncl ? totalPriceVat : totalPriceVat0;
  const marginEur = sellingAfter - impliedDirect - commissionEur;

  const discountEur =
    reverseVat || !identityOnVatIncl
      ? totalPriceVat0BeforeDiscount - totalPriceVat0
      : totalPriceVatBeforeDiscount - totalPriceVat;

  return {
    ...result,
    commissionEur,
    marginEur,
    totalPriceVat0,
    vatAmount,
    totalPriceVat,
    discountPercent,
    discountEur,
    totalPriceVatBeforeDiscount,
    totalPriceVat0BeforeDiscount,
  };
}

export function writeDiscountedResultToContext(
  context: Record<string, number>,
  result: DiscountableTotals,
): void {
  context[DISCOUNT_PERCENT_KEY] = result.discountPercent;
  context[DISCOUNT_EUR_KEY] = result.discountEur;
  context.kokonaishinta = result.totalPriceVat;
  context.kokonaishinta_alv0 = result.totalPriceVat0;
  context.myyntikate = result.marginEur;
  context.myyntipalkkio = result.commissionEur;
  context.alv_maara = result.vatAmount;
}

export function discountPercentFromContext(context: Record<string, number>): number {
  return clampDiscountPercent(context[DISCOUNT_PERCENT_KEY] ?? 0);
}

export function hasRecordedDiscount(
  result: Pick<DiscountableTotals, 'discountPercent'>,
): boolean {
  return result.discountPercent > 0;
}
