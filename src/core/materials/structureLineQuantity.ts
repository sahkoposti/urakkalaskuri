/** Määrä on tasan 0, myös -0. NaN, puuttuva ja muu luku eivät ole. */
export function structureLineQuantityIsZero(line: { quantity: number | null | undefined }): boolean {
  return line.quantity === 0;
}