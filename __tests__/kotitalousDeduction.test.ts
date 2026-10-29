import {
  DEFAULT_KTV_SETTINGS,
  KTV_DEFAULT_NOTE,
  ktvPriceSplit,
  ktvWorkShareVatIncluded,
  kotitalousDeduction,
  normalizeKtvSettings,
} from '../src/core/pdf/kotitalousDeduction';

const defaults = { ...DEFAULT_KTV_SETTINGS };

describe('kotitalousDeduction', () => {
  it('vero.fi example: 8000 € work incl. VAT -> 3200 - 150 = 3050, capped to 2100', () => {
    const r = kotitalousDeduction({ totalPriceVat: 8000, materialsVat: 0, settings: defaults });
    expect(r.workShareVatIncluded).toBe(8000);
    expect(r.grossDeduction).toBe(3200);
    expect(r.deductionAmount).toBe(2100);
    expect(r.capApplied).toBe(true);
    expect(r.estimatedCostAfterDeduction).toBe(5900);
  });

  it('work + materials: base is total incl. VAT minus materials incl. VAT', () => {
    const r = kotitalousDeduction({ totalPriceVat: 6000, materialsVat: 1500, settings: defaults });
    expect(r.workShareVatIncluded).toBe(4500);
    expect(r.grossDeduction).toBe(1800);
    expect(r.deductionAmount).toBe(1650);
    expect(r.capApplied).toBe(false);
    expect(r.estimatedCostAfterDeduction).toBe(4350);
  });

  it('cap is reached at 5625 € work share with defaults', () => {
    expect(kotitalousDeduction({ totalPriceVat: 5625, materialsVat: 0, settings: defaults }).deductionAmount).toBe(2100);
    expect(kotitalousDeduction({ totalPriceVat: 5625, materialsVat: 0, settings: defaults }).capApplied).toBe(false);
  });

  it('deductible can zero out small jobs; zero work gives zero', () => {
    expect(kotitalousDeduction({ totalPriceVat: 300, materialsVat: 0, settings: defaults }).deductionAmount).toBe(0);
    const zero = kotitalousDeduction({ totalPriceVat: 1000, materialsVat: 1200, settings: defaults });
    expect(zero.workShareVatIncluded).toBe(0);
    expect(zero.deductionAmount).toBe(0);
    expect(zero.estimatedCostAfterDeduction).toBe(1000);
  });

  it('discount case: discount reduces only the work share; materials unchanged (Eemil 29.10. 17.33)', () => {
    // 2480 before, 10 % off -> 2232 paid; materials 248 as given -> work 1984
    const r = kotitalousDeduction({ totalPriceVat: 2232, materialsVat: 248, settings: defaults });
    expect(r.materialsShareVatIncluded).toBe(248);
    expect(r.workShareVatIncluded).toBe(1984);
    expect(r.deductionAmount).toBe(643.6);
  });

  it('edge: discount larger than the work share clamps work to 0 (no negative base, no deduction)', () => {
    // paid 300 after a big discount, materials 400 -> work would be -100 -> 0
    const r = kotitalousDeduction({ totalPriceVat: 300, materialsVat: 400, settings: defaults });
    expect(r.workShareVatIncluded).toBe(0);
    expect(r.materialsShareVatIncluded).toBe(400);
    expect(r.grossDeduction).toBe(0);
    expect(r.deductionAmount).toBe(0);
  });

  it('travel time/costs stay in the work share (part of the price, not materials)', () => {
    // price 2000 incl. 200 travel; materials 300 -> work 1700 incl. travel
    const r = kotitalousDeduction({ totalPriceVat: 2000, materialsVat: 300, settings: defaults });
    expect(r.workShareVatIncluded).toBe(1700);
  });

  it('uses company settings instead of defaults (not hardcoded)', () => {
    const r = kotitalousDeduction({
      totalPriceVat: 10000,
      materialsVat: 0,
      settings: { ratePercent: 35, deductibleEur: 100, capEur: 1600 },
    });
    expect(r.grossDeduction).toBe(3500);
    expect(r.deductionAmount).toBe(1600);
    const noCap = kotitalousDeduction({
      totalPriceVat: 1000,
      materialsVat: 0,
      settings: { ratePercent: 60, deductibleEur: 0, capEur: 3500 },
    });
    expect(noCap.deductionAmount).toBe(600);
  });
});

describe('ktvWorkShareVatIncluded', () => {
  it('price paid minus materials; never negative; NaN safe', () => {
    expect(ktvWorkShareVatIncluded(2232, 248)).toBe(1984);
    expect(ktvWorkShareVatIncluded(100, 200)).toBe(0);
    expect(ktvWorkShareVatIncluded(Number.NaN, 10)).toBe(0);
  });

  it('split: materials as given, work = paid - materials', () => {
    expect(ktvPriceSplit(1800, 400)).toEqual({ workShareVatIncluded: 1400, materialsShareVatIncluded: 400 });
    expect(ktvPriceSplit(0, 400)).toEqual({ workShareVatIncluded: 0, materialsShareVatIncluded: 400 });
  });
});

describe('normalizeKtvSettings', () => {
  it('returns defaults for missing or corrupt data', () => {
    expect(normalizeKtvSettings(undefined)).toEqual(DEFAULT_KTV_SETTINGS);
    expect(normalizeKtvSettings('garbage')).toEqual(DEFAULT_KTV_SETTINGS);
    expect(normalizeKtvSettings({ ratePercent: -5, deductibleEur: 'x', capEur: Infinity })).toEqual(DEFAULT_KTV_SETTINGS);
    expect(normalizeKtvSettings({ ratePercent: 150 }).ratePercent).toBe(40);
  });

  it('merges partial stored values and accepts Finnish decimal comma', () => {
    expect(normalizeKtvSettings({ ratePercent: '37,5' })).toEqual({ ratePercent: 37.5, deductibleEur: 150, capEur: 2100 });
    expect(normalizeKtvSettings({ capEur: 4200 }).capEur).toBe(4200);
  });

  it('default PDF note says it is an estimate for one person', () => {
    expect(KTV_DEFAULT_NOTE).toContain('arvio yhdelle henkilölle');
  });
});
