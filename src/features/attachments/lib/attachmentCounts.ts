import type { Attachment } from './types';

/** Tarjoukseen lasketaan offer ja both, kortille card ja both. */
export function attachmentDestinationCounts(items: readonly Attachment[]): { offer: number; card: number } {
  let offer = 0;
  let card = 0;
  for (const item of items) {
    if (item.destination === 'offer' || item.destination === 'both') offer += 1;
    if (item.destination === 'card' || item.destination === 'both') card += 1;
  }
  return { offer, card };
}
