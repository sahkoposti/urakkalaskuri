/**
 * Juokseva tarjousnumero (suunnitelma §7, T5). Yksi laite (Eemil 29.10.2026), aloitus asetuksista (oletus 10285).
 *
 * - Ensimmäinen tarjous-PDF laskelmalle → numero myönnetään ja laskuri kasvaa.
 * - Uudelleentulostus → sama numero, laskuri ei muutu.
 * - Aloitusnumeron nosto yli seuraavan → laskuri hyppää. Lasku ei palauta käytettyjä numeroita (varoitus).
 * - Urakkakortti ei koskaan myönnä numeroa (kutsuja ei kutsu tätä).
 */

export const NEXT_OFFER_NUMBER_KEY = 'pdf_next_offer_number';

export type OfferNumberAssignment = {
  offerNumber: number;
  /** Laskurin uusi arvo (seuraava myönnettävä). */
  nextOfferNumber: number;
  /** true = numero myönnettiin nyt (tallennettava laskelmalle). */
  assigned: boolean;
};

function validPositiveInt(value: unknown): number | undefined {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : undefined;
}

/** Seuraava myönnettävä numero: tallennettu laskuri, mutta vähintään aloitusnumero. */
export function effectiveNextOfferNumber(storedNext: unknown, offerNumberStart: number): number {
  const start = validPositiveInt(offerNumberStart) ?? 1;
  const next = validPositiveInt(storedNext);
  return next === undefined ? start : Math.max(next, start);
}

export function assignOfferNumber(
  existingOfferNumber: number | undefined | null,
  storedNext: unknown,
  offerNumberStart: number,
): OfferNumberAssignment {
  const next = effectiveNextOfferNumber(storedNext, offerNumberStart);
  const existing = validPositiveInt(existingOfferNumber);
  if (existing !== undefined) {
    return { offerNumber: existing, nextOfferNumber: next, assigned: false };
  }
  return { offerNumber: next, nextOfferNumber: next + 1, assigned: true };
}

/**
 * Varoitus asetuksiin, kun aloitusnumero on pienempi kuin jo käytetty laskuri.
 * Palauttaa null, kun varoitusta ei tarvita.
 */
export function offerNumberStartWarning(offerNumberStart: number, storedNext: unknown): string | null {
  const next = validPositiveInt(storedNext);
  const start = validPositiveInt(offerNumberStart);
  if (next === undefined || start === undefined || start >= next) return null;
  return `Numeroita on jo käytetty. Pienempi aloitus ei palauta käytettyjä numeroita: seuraava tarjous saa numeron ${next}.`;
}

/** Tallennuksessa (myös Muokkaa): uusi arvo voittaa, muuten säilytetään olemassa oleva numero. */
export function offerNumberOnSave(
  recordOfferNumber: number | undefined | null,
  existingStoredOfferNumber: number | undefined | null,
): number | null {
  return validPositiveInt(recordOfferNumber) ?? validPositiveInt(existingStoredOfferNumber) ?? null;
}
