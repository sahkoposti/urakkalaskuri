import {
  DEFAULT_KHV_SETTINGS,
  KHV_DEFAULT_NOTE,
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

  it('discount case: uses discounted total incl. VAT as given by caller', () => {
    const r = kotitalousDeduction({ totalPriceVat: 2480 * 0.9, materialsVat: 248, settings: defaults });
    expect(r.workShareVatIncluded).toBe(1984);
    expect(r.deductionAmount).toBe(643.6);
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
  it('is total after discount minus materials as given (no separate material discount)', () => {
    expect(khvWorkShareVatIncluded(2232, 248)).toBe(1984);
    expect(khvWorkShareVatIncluded(100, 200)).toBe(0);
    expect(khvWorkShareVatIncluded(Number.NaN, 10)).toBe(0);
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
