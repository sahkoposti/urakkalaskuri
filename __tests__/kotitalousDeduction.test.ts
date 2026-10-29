import {
  DEFAULT_KHV_SETTINGS,
  KHV_DEFAULT_NOTE,
  khvPriceSplit,
  khvWorkShareVatIncluded,
  kotitalousDeduction,
  normalizeKhvSettings,
} from '../src/core/pdf/kotitalousDeduction';

const defaults = { ...DEFAULT_KHV_SETTINGS };

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

  it('discount case: whole price split, discount applied proportionally to work and materials', () => {
    // 2480 before, 10 % off -> 2232; materials 248 -> 223.20; work 2008.80
    const r = kotitalousDeduction({ totalPriceVat: 2232, totalPriceVatBeforeDiscount: 2480, materialsVat: 248, settings: defaults });
    expect(r.materialsShareVatIncluded).toBe(223.2);
    expect(r.workShareVatIncluded).toBe(2008.8);
    expect(r.workShareVatIncluded + r.materialsShareVatIncluded).toBe(2232);
    expect(r.deductionAmount).toBe(653.52);
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

describe('khvWorkShareVatIncluded', () => {
  it('no discount: total minus materials; never negative; NaN safe', () => {
    expect(khvWorkShareVatIncluded(2232, 248)).toBe(1984);
    expect(khvWorkShareVatIncluded(100, 200)).toBe(0);
    expect(khvWorkShareVatIncluded(Number.NaN, 10)).toBe(0);
    expect(khvWorkShareVatIncluded(2232, 248, 2232)).toBe(1984);
  });

  it('with discount: materials reduced by the same factor; split sums to the paid price', () => {
    expect(khvPriceSplit(1800, 400, 2000)).toEqual({ workShareVatIncluded: 1440, materialsShareVatIncluded: 360 });
    expect(khvPriceSplit(0, 400, 2000)).toEqual({ workShareVatIncluded: 0, materialsShareVatIncluded: 0 });
  });
});

describe('normalizeKhvSettings', () => {
  it('returns defaults for missing or corrupt data', () => {
    expect(normalizeKhvSettings(undefined)).toEqual(DEFAULT_KHV_SETTINGS);
    expect(normalizeKhvSettings('garbage')).toEqual(DEFAULT_KHV_SETTINGS);
    expect(normalizeKhvSettings({ ratePercent: -5, deductibleEur: 'x', capEur: Infinity })).toEqual(DEFAULT_KHV_SETTINGS);
    expect(normalizeKhvSettings({ ratePercent: 150 }).ratePercent).toBe(40);
  });

  it('merges partial stored values and accepts Finnish decimal comma', () => {
    expect(normalizeKhvSettings({ ratePercent: '37,5' })).toEqual({ ratePercent: 37.5, deductibleEur: 150, capEur: 2100 });
    expect(normalizeKhvSettings({ capEur: 4200 }).capEur).toBe(4200);
  });

  it('default PDF note says it is an estimate for one person', () => {
    expect(KHV_DEFAULT_NOTE).toContain('arvio yhdelle henkilölle');
  });
});
