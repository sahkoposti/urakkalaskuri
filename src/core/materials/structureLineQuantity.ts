/**
 * Määrä ei kerää hintoja/tulostetta (sama kuin nolla).
 * Tasan 0, negatiivinen ja -0: pois. NaN, puuttuva ja positiivinen: ei.
 */
export function structureLineQuantityIsZero(line: { quantity: number | null | undefined }): boolean {
  const quantity = line.quantity;
  return typeof quantity === 'number' && Number.isFinite(quantity) && quantity <= 0;
}