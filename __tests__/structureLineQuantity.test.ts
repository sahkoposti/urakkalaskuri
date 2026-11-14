import { structureLineQuantityIsZero } from '../src/core/materials/structureLineQuantity';

describe('structureLineQuantityIsZero', () => {
  it('is true only for numeric 0 and -0', () => {
    expect(structureLineQuantityIsZero({ quantity: 0 })).toBe(true);
    expect(structureLineQuantityIsZero({ quantity: -0 })).toBe(true);
    expect(structureLineQuantityIsZero({ quantity: Number.NaN })).toBe(false);
    expect(structureLineQuantityIsZero({ quantity: undefined })).toBe(false);
    expect(structureLineQuantityIsZero({ quantity: null })).toBe(false);
    expect(structureLineQuantityIsZero({ quantity: 0.01 })).toBe(false);
  });
});