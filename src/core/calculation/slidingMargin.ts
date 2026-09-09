export type SlidingMarginParams = {
  /** Myyntihinta (alv0), jossa käytetään lowPercent. */
  lowAmount: number;
  /** Yrityksen kate (%) myyntihinnasta alarajalla. */
  lowPercent: number;
  /** Myyntihinta (alv0), jossa käytetään highPercent. */
  highAmount: number;
  /** Yrityksen kate (%) myyntihinnasta ylärajalla. */
  highPercent: number;
  commissionPercent: number;
};

function costShare(katePercent: number, commissionPercent: number): number {
  return 1 - katePercent / 100 - commissionPercent / 100;
}

/**
 * Liukuva myyntihinta (alv0) suorista kustannuksista.
 *
 * Kate-% interpoloidaan lineaarisesti myyntihinnan mukaan:
 *   lowAmount → lowPercent, highAmount → highPercent.
 * Myyntipalkkio on sen päälle. Suljettu muoto on sama neliöjuurikaava
 * kuin lomakkeen kokonaishinta_alv0-kentässä.
 */
export function slidingSellingPriceAlv0(
  directCostsAlv0: number,
  params: SlidingMarginParams,
): number {
  if (!(directCostsAlv0 > 0)) return 0;

  const { lowAmount: p1, highAmount: p2, lowPercent: k1, highPercent: k2, commissionPercent: c } =
    params;

  const share1 = costShare(k1, c);
  const share2 = costShare(k2, c);
  if (share1 <= 0 || share2 <= 0) {
    throw new Error('Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.');
  }

  if (!(p1 > 0) || !(p2 > p1) || k1 === k2) {
    return directCostsAlv0 / share1;
  }

  const lowCost = p1 * share1;
  const highCost = p2 * share2;
  if (directCostsAlv0 <= lowCost) return directCostsAlv0 / share1;
  if (directCostsAlv0 >= highCost) return directCostsAlv0 / share2;

  // k(P) = k1 + (k2-k1)*(P-P1)/(P2-P1)
  // C = P * (1 - k(P)/100 - c/100)
  const dk = (k2 / 100 - k1 / 100) / (p2 - p1);
  const a = dk;
  const b = -(share1 + dk * p1);
  const disc = b * b - 4 * a * directCostsAlv0;
  if (disc < 0) return directCostsAlv0 / share1;

  const sqrtDisc = Math.sqrt(disc);
  const r1 = (-b + sqrtDisc) / (2 * a);
  const r2 = (-b - sqrtDisc) / (2 * a);
  const inRange = [r1, r2].filter((price) => price >= p1 && price <= p2);
  if (inRange.length === 1) return inRange[0]!;
  if (inRange.length === 2) return Math.max(inRange[0]!, inRange[1]!);

  const candidates = [r1, r2].filter((price) => price > 0);
  if (candidates.length === 0) return directCostsAlv0 / share1;
  return candidates.reduce((best, price) =>
    Math.abs(price - (p1 + p2) / 2) < Math.abs(best - (p1 + p2) / 2) ? price : best,
  );
}

export function slidingMarginParamsFromContext(
  context: Record<string, number>,
): SlidingMarginParams {
  return {
    lowAmount: context['asetukset.myyntikate_alaraja_eur'] ?? 0,
    lowPercent: context['asetukset.myyntikate_alaraja_prosentti'] ?? 0,
    highAmount: context['asetukset.myyntikate_ylaraja_eur'] ?? 0,
    highPercent: context['asetukset.myyntikate_ylaraja_prosentti'] ?? 0,
    commissionPercent: context['asetukset.myyntipalkkio_prosentti'] ?? 0,
  };
}
