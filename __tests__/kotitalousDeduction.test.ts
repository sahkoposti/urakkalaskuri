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

describe('kotitalousDeduction persons', () => {
  it('defaults to one person when persons is omitted', () => {
    const r = kotitalousDeduction({ totalPriceVat: 8000, materialsVat: 0, settings: defaults });
    expect(r.persons).toBe(1);
    expect(r.deductionAmount).toBe(2100);
  });

  it('uses only the person count that raises the deduction', () => {
    const twoOpen = kotitalousDeduction({ totalPriceVat: 8000, materialsVat: 0, settings: defaults, persons: 2 });
    expect(twoOpen.persons).toBe(2);
    expect(twoOpen.personsUsed).toBe(2);
    expect(twoOpen.grossDeduction).toBe(3200);
    expect(twoOpen.deductionAmount).toBe(2900);
    expect(twoOpen.capApplied).toBe(false);

    const twoCapped = kotitalousDeduction({ totalPriceVat: 12000, materialsVat: 0, settings: defaults, persons: 2 });
    expect(twoCapped.personsUsed).toBe(2);
    expect(twoCapped.deductionAmount).toBe(4200);
    expect(twoCapped.capApplied).toBe(true);

    // G=3200. k=1 gives 2100, k=2 gives 2900, k=3 gives 2750. Highest is k=2.
    const threeOpen = kotitalousDeduction({ totalPriceVat: 8000, materialsVat: 0, settings: defaults, persons: 3 });
    expect(threeOpen.persons).toBe(3);
    expect(threeOpen.personsUsed).toBe(2);
    expect(threeOpen.deductionAmount).toBe(2900);
    expect(threeOpen.capApplied).toBe(false);

    const threeCapped = kotitalousDeduction({ totalPriceVat: 20000, materialsVat: 0, settings: defaults, persons: 3 });
    expect(threeCapped.personsUsed).toBe(3);
    expect(threeCapped.deductionAmount).toBe(6300);
    expect(threeCapped.capApplied).toBe(true);
  });

  it('does not charge a second deductible when one person gives more', () => {
    // G=800. k=1: 650. k=2: 500. One person wins.
    const scaled = kotitalousDeduction({ totalPriceVat: 2000, materialsVat: 0, settings: defaults, persons: 2 });
    expect(scaled.grossDeduction).toBe(800);
    expect(scaled.personsUsed).toBe(1);
    expect(scaled.deductionAmount).toBe(650);
    const zero = kotitalousDeduction({ totalPriceVat: 300, materialsVat: 400, settings: defaults, persons: 3 });
    expect(zero.workShareVatIncluded).toBe(0);
    expect(zero.personsUsed).toBe(1);
    expect(zero.deductionAmount).toBe(0);
  });

  it('rejects 0, 11, 2.5 and NaN', () => {
    for (const persons of [0, 11, 2.5, Number.NaN]) {
      expect(() => kotitalousDeduction({ totalPriceVat: 2000, materialsVat: 0, settings: defaults, persons })).toThrow(
        'Henkilöiden määrä on kokonaisluku väliltä 1–10.',
      );
    }
  });

  it('uses company cap and deductible multiplied by n, not hardcoded 150 and 2100', () => {
    const r = kotitalousDeduction({
      totalPriceVat: 20000,
      materialsVat: 0,
      settings: { ratePercent: 40, deductibleEur: 100, capEur: 1000 },
      persons: 2,
    });
    expect(r.personsUsed).toBe(2);
    expect(r.deductionAmount).toBe(2000);
    expect(r.capApplied).toBe(true);
  });
});

describe('persons actually needed', () => {
  const at = (gross: number, persons: number, settings = defaults) =>
    kotitalousDeduction({
      totalPriceVat: gross / (settings.ratePercent / 100),
      materialsVat: 0,
      settings,
      persons,
    });

  it('n=2 and G=609.93 uses one deductible, not both', () => {
    const r = at(609.93, 2);
    expect(r.grossDeduction).toBe(609.93);
    expect(r.persons).toBe(2);
    expect(r.personsUsed).toBe(1);
    expect(r.deductionAmount).toBe(459.93);
    expect(r.deductionAmount).not.toBe(309.93);
    expect(r.capApplied).toBe(false);
  });

  it('exact cap boundary G=2250 stays on one person without capApplied', () => {
    const r = at(2250, 2);
    expect(r.grossDeduction).toBe(2250);
    expect(r.workShareVatIncluded).toBe(5625);
    expect(r.personsUsed).toBe(1);
    expect(r.deductionAmount).toBe(2100);
    expect(r.capApplied).toBe(false);
  });

  it('just over the one-person cap still prefers 2100 over the two-person 1950.01', () => {
    const r = at(2250.01, 2);
    expect(r.grossDeduction).toBe(2250.01);
    expect(r.personsUsed).toBe(1);
    expect(r.deductionAmount).toBe(2100);
    expect(r.capApplied).toBe(true);
  });

  it('tie at 2400 keeps the smaller k, and 2500 needs the second person', () => {
    const tie = at(2400, 2);
    expect(tie.grossDeduction).toBe(2400);
    expect(tie.workShareVatIncluded).toBe(6000);
    expect(tie.personsUsed).toBe(1);
    expect(tie.deductionAmount).toBe(2100);
    expect(tie.capApplied).toBe(true);

    const second = at(2500, 2);
    expect(second.grossDeduction).toBe(2500);
    expect(second.workShareVatIncluded).toBe(6250);
    expect(second.personsUsed).toBe(2);
    expect(second.deductionAmount).toBe(2200);
    expect(second.capApplied).toBe(false);
  });

  it('n=3 picks the k with the higher deduction, including the full cap', () => {
    // G=5000. k=1: min(2100, 4850)=2100. k=2: min(4200, 4700)=4200.
    // k=3: min(6300, 4550)=4550. Highest is 4550, so k_used=3, not the capped k=2.
    const mid = at(5000, 3);
    expect(mid.grossDeduction).toBe(5000);
    expect(mid.personsUsed).toBe(3);
    expect(mid.deductionAmount).toBe(4550);
    expect(mid.capApplied).toBe(false);

    // G=7000. k=2: min(4200, 6700)=4200. k=3: min(6300, 6550)=6300.
    const high = at(7000, 3);
    expect(high.grossDeduction).toBe(7000);
    expect(high.personsUsed).toBe(3);
    expect(high.deductionAmount).toBe(6300);
    expect(high.capApplied).toBe(true);

    const huge = at(20000, 3);
    expect(huge.personsUsed).toBe(3);
    expect(huge.deductionAmount).toBe(6300);
    expect(huge.capApplied).toBe(true);
  });

  it('n=1 matches the previous one-person results below, at and above the cap', () => {
    const below = at(1000, 1);
    expect(below.personsUsed).toBe(1);
    expect(below.deductionAmount).toBe(850);
    expect(below.capApplied).toBe(false);

    const atCap = at(2250, 1);
    expect(atCap.personsUsed).toBe(1);
    expect(atCap.deductionAmount).toBe(2100);
    expect(atCap.capApplied).toBe(false);

    const above = at(3200, 1);
    expect(above.personsUsed).toBe(1);
    expect(above.deductionAmount).toBe(2100);
    expect(above.capApplied).toBe(true);
    expect(above.estimatedCostAfterDeduction).toBe(8000 - 2100);
  });

  it('uses custom deductible and cap, not 150 and 2100', () => {
    const settings = { ratePercent: 30, deductibleEur: 100, capEur: 1500 };
    const oneWins = at(600, 2, settings);
    expect(oneWins.grossDeduction).toBe(600);
    expect(oneWins.personsUsed).toBe(1);
    expect(oneWins.deductionAmount).toBe(500);

    const twoWins = at(3000, 3, settings);
    expect(twoWins.grossDeduction).toBe(3000);
    expect(twoWins.personsUsed).toBe(2);
    expect(twoWins.deductionAmount).toBe(2800);
    expect(twoWins.capApplied).toBe(false);
  });

  it('stays non-decreasing in G and never below the old all-n formula', () => {
    const oldForAll = (gross: number, n: number) => Math.min(n * 2100, Math.max(0, gross - n * 150));
    for (let n = 1; n <= 4; n += 1) {
      let previous = -1;
      for (let gross = 0; gross <= 20000; gross += 50) {
        const r = at(gross, n);
        expect(r.grossDeduction).toBe(gross);
        expect(r.deductionAmount).toBeGreaterThanOrEqual(previous);
        expect(r.deductionAmount).toBeGreaterThanOrEqual(oldForAll(gross, n));
        expect(r.personsUsed).toBeGreaterThanOrEqual(1);
        expect(r.personsUsed).toBeLessThanOrEqual(n);
        previous = r.deductionAmount;
      }
    }
  });
});
