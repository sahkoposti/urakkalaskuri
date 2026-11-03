import {
  assignOfferNumber,
  effectiveNextOfferNumber,
  offerNumberOnSave,
  offerNumberStartWarning,
} from '../src/core/pdf/offerNumber';

describe('offer number', () => {
  it('first offer gets the start number and advances the counter', () => {
    expect(assignOfferNumber(undefined, undefined, 10285)).toEqual({
      offerNumber: 10285,
      nextOfferNumber: 10286,
      assigned: true,
    });
  });

  it('reprint keeps the same number and does not move the counter', () => {
    expect(assignOfferNumber(10285, 10290, 10285)).toEqual({
      offerNumber: 10285,
      nextOfferNumber: 10290,
      assigned: false,
    });
  });

  it('continues from the stored counter', () => {
    expect(assignOfferNumber(null, 10300, 10285).offerNumber).toBe(10300);
  });

  it('raising the start above the counter jumps; lowering never reuses numbers', () => {
    expect(effectiveNextOfferNumber(10300, 20000)).toBe(20000);
    expect(effectiveNextOfferNumber(10300, 100)).toBe(10300);
  });

  it('ignores corrupt stored values', () => {
    expect(effectiveNextOfferNumber('abc', 10285)).toBe(10285);
    expect(effectiveNextOfferNumber(-5, 10285)).toBe(10285);
    expect(effectiveNextOfferNumber('10400', 10285)).toBe(10400);
    expect(assignOfferNumber(0, undefined, 10285).offerNumber).toBe(10285);
  });

  it('warns only when the start is below an already used counter', () => {
    expect(offerNumberStartWarning(10285, undefined)).toBeNull();
    expect(offerNumberStartWarning(10300, 10300)).toBeNull();
    expect(offerNumberStartWarning(10285, 10300)).toContain('10300');
  });

  it('save keeps an existing number unless the record carries one', () => {
    expect(offerNumberOnSave(undefined, 10285)).toBe(10285);
    expect(offerNumberOnSave(10290, 10285)).toBe(10290);
    expect(offerNumberOnSave(undefined, null)).toBeNull();
  });
});
