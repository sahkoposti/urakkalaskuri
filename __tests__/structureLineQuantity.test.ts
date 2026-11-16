import { structureLineQuantityIsZero } from '../src/core/materials/structureLineQuantity';

describe('structureLineQuantityIsZero', () => {
  it('is true for finite non-positive määrä (0, -0, negative)', () => {
    expect(structureLineQuantityIsZero({ quantity: 0 })).toBe(true);
    expect(structureLineQuantityIsZero({ quantity: -0 })).toBe(true);
    expect(structureLineQuantityIsZero({ quantity: -2 })).toBe(true);
    expect(structureLineQuantityIsZero({ quantity: Number.NaN })).toBe(false);
    expect(structureLineQuantityIsZero({ quantity: undefined })).toBe(false);
    expect(structureLineQuantityIsZero({ quantity: null })).toBe(false);
    expect(structureLineQuantityIsZero({ quantity: 0.01 })).toBe(false);
  });
});