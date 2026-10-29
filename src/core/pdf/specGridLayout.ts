import type { SpecCard } from './offerPageSpecs';

export type SpecGridMode = 'none' | 'single' | 'grid';

export type SpecGridCard = SpecCard & { fullWidth: boolean };

export type SpecGridLayout = { mode: SpecGridMode; cards: SpecGridCard[] };

/**
 * Suunnitelma §1.2: 0 korttia → ruudukko pois; 1 → täysi leveys; 2+ → kaksi saraketta
 * (kolmas kortti aloittaa seuraavan rivin).
 */
export function specGridLayout(cards: SpecCard[]): SpecGridLayout {
  const nonEmpty = cards.filter((card) => card.rows.length > 0);
  if (nonEmpty.length === 0) return { mode: 'none', cards: [] };
  if (nonEmpty.length === 1) return { mode: 'single', cards: [{ ...nonEmpty[0], fullWidth: true }] };
  return { mode: 'grid', cards: nonEmpty.map((card) => ({ ...card, fullWidth: false })) };
}
