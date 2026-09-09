/**
 * Rungon omistamat hintajohdannaiset.
 * JSON vie kokonaishinta_alv0; runko laskee ALV:n ja sis. ALV -hinnan.
 * Yliajettu kokonaishinta (sis. ALV) kääntää suhteen: siitä johdetaan alv0.
 */

export type OwnedVatTotalsOptions = {
  /** Lomakkeella yliajettu kokonaishinta (sis. ALV). */
  sellingPriceVatOverridden?: boolean;
};

export function applyOwnedVatTotals(
  context: Record<string, number>,
  vatPercent: number,
  reverseVat: boolean,
  options: OwnedVatTotalsOptions = {},
): void {
  if (options.sellingPriceVatOverridden) {
    const total = context.kokonaishinta;
    if (total === undefined || !Number.isFinite(total)) return;

    if (reverseVat) {
      context.alv_maara = 0;
      context.kokonaishinta_alv0 = total;
      context.kokonaishinta = total;
      return;
    }

    const vat0 = total / (1 + vatPercent / 100);
    context.kokonaishinta_alv0 = vat0;
    context.alv_maara = total - vat0;
    return;
  }

  const vat0 = context.kokonaishinta_alv0;
  if (vat0 === undefined || !Number.isFinite(vat0)) return;

  if (reverseVat) {
    context.alv_maara = 0;
    context.kokonaishinta = vat0;
    return;
  }

  const vatAmount = vat0 * (vatPercent / 100);
  context.alv_maara = vatAmount;
  context.kokonaishinta = vat0 + vatAmount;
}
