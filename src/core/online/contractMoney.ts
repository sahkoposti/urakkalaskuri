/**
 * Palvelinsopimuksen (v0) rahasäännöt kokonaisluvuilla. Sama laskenta kuin palvelimen units.ts:ssä.
 * Pyöristys: puolikas poispäin nollasta. Liukulukuja ei käytetä summissa.
 */

/** num / den, puolikas poispäin nollasta. den > 0. */
export function divRoundHalfAway(num: bigint, den: bigint): bigint {
  if (den <= BigInt(0)) throw new Error('denominator must be positive');
  const neg = num < BigInt(0);
  const a = neg ? -num : num;
  const q = (a * BigInt(2) + den) / (BigInt(2) * den);
  return neg ? -q : q;
}

function toBig(n: number, name: string): bigint {
  if (!Number.isSafeInteger(n)) throw new Error(`${name} must be a safe integer`);
  return BigInt(n);
}

function fromBig(b: bigint): number {
  if (b > BigInt(Number.MAX_SAFE_INTEGER) || b < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('result out of safe integer range');
  }
  return Number(b);
}

/** Rivin netto: round(qty_milli × unit_e4 × (10000 − discount_bp) / 10^9). */
export function lineNetCents(qtyMilli: number, unitE4: number, discountBp: number): number {
  const d = toBig(discountBp, 'discount_bp');
  if (d < BigInt(0) || d > BigInt(10000)) throw new Error('discount_bp must be 0..10000');
  return fromBig(
    divRoundHalfAway(toBig(qtyMilli, 'qty_milli') * toBig(unitE4, 'unit_e4') * (BigInt(10000) - d), BigInt(1_000_000_000)),
  );
}

/** Rivin arvo ennen alennusta senteissä: round(qty_milli × unit_e4 / 10^5). */
export function lineGrossBeforeDiscountCents(qtyMilli: number, unitE4: number): number {
  return fromBig(divRoundHalfAway(toBig(qtyMilli, 'qty_milli') * toBig(unitE4, 'unit_e4'), BigInt(100_000)));
}

/** ALV kerran verokannan summatusta netosta: round(net × vat_bp / 10000). */
export function vatCents(netCents: number, vatBp: number): number {
  return fromBig(divRoundHalfAway(toBig(netCents, 'net_cents') * toBig(vatBp, 'vat_bp'), BigInt(10_000)));
}

/** Peruspisteosuus: round(cents × bp / 10000). */
export function bpOf(cents: number, bp: number): number {
  return vatCents(cents, bp);
}

/**
 * Liukuluku kokonaisluvuksi kertoimella (esim. euro → sentti, 100).
 * Desimaaliesitys pyöristetään ensin 9 desimaaliin, jotta 0.1 + 0.2 -tyyppinen virhe ei käännä puolikasta.
 * null = ei luku tai liian suuri.
 */
export function scaledInt(value: number, factor: number): number | null {
  if (!Number.isFinite(value)) return null;
  const cleaned = Number((value * factor).toFixed(6));
  const rounded = cleaned < 0 ? -Math.round(-cleaned) : Math.round(cleaned);
  // Math.round pyöristää .5 ylöspäin; negatiivinen käännetään, jolloin puolikas menee poispäin nollasta.
  return Number.isSafeInteger(rounded) ? (Object.is(rounded, -0) ? 0 : rounded) : null;
}

/** ALV-koodit ja verokannat (sopimus kohta 1). */
export const VAT_CODES = { YLEINEN: 2550, NOLLA: 0, AVL8c: 0 } as const;
export type VatCode = keyof typeof VAT_CODES;
