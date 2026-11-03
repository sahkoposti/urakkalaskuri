import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import {
  calculationWithOfferValidDays,
  offerValidDaysFieldText,
  offerValidDaysForSave,
  parseOfferValidDaysInput,
  readOfferValidDays,
} from '../src/core/pdf/offerValidDays';
import { preserveCalculationSnapshot } from '../src/core/pdf/urakkakorttiCard';
import { input, record } from './pdfFixtures';

describe('offerValidDays', () => {
  it('prefills the company default and omits the snapshot key for that value', () => {
    const rec = record({});
    expect(offerValidDaysFieldText(rec.formSnapshot, 31)).toBe('31');
    expect(offerValidDaysFieldText(rec.formSnapshot, 14)).toBe('14');
    expect(readOfferValidDays(rec.formSnapshot, 14)).toBe(14);
    const same = calculationWithOfferValidDays(rec, 31, 31);
    expect(same).toBe(rec);
    expect(same.formSnapshot?.offerValidDays).toBeUndefined();
    const custom = calculationWithOfferValidDays(rec, 45, 31);
    expect(custom.formSnapshot?.offerValidDays).toBe(45);
    const reverted = calculationWithOfferValidDays(custom, 31, 31);
    expect(reverted.formSnapshot?.offerValidDays).toBeUndefined();
    expect(calculationWithOfferValidDays(custom, 45, 31)).toBe(custom);
  });

  it('accepts 1..365 and rejects empty, decimal, 0 and 366', () => {
    expect(parseOfferValidDaysInput('1')).toBe(1);
    expect(parseOfferValidDaysInput('365')).toBe(365);
    expect(parseOfferValidDaysInput(' 14 ')).toBe(14);
    expect(parseOfferValidDaysInput('')).toBe('empty');
    expect(parseOfferValidDaysInput('0')).toBe('invalid');
    expect(parseOfferValidDaysInput('366')).toBe('invalid');
    expect(parseOfferValidDaysInput('1,5')).toBe('invalid');
    expect(parseOfferValidDaysInput('abc')).toBe('invalid');
    expect(() => calculationWithOfferValidDays(record({}), 0, 31)).toThrow(/1–365/);
  });

  it('keeps a custom value across a wizard rebuild and uses it for Voimassa', () => {
    const previous = calculationWithOfferValidDays(record({}), 14, 31);
    const rebuilt = preserveCalculationSnapshot(record({}), previous.formSnapshot);
    expect(rebuilt.formSnapshot?.offerValidDays).toBe(14);
    const ctx = buildPdfContext(
      input(previous, { offerCompany: { ...defaultOfferCompanySettings, offerValidDays: 31 } }),
    );
    expect(ctx.offerInfo.find((row) => row.label === 'Voimassa')?.value).toBe('24.10.2026');
    const fallback = buildPdfContext(input(record({})));
    expect(fallback.offerInfo.find((row) => row.label === 'Voimassa')?.value).toBe('10.11.2026');
    expect(readOfferValidDays({ formId: '', formVersion: 0, fields: [], offerValidDays: 0 }, 31)).toBe(31);
  });

  it('does not show or store 31 before a company default other than 31 has loaded', () => {
    const rec = record({});
    expect(offerValidDaysFieldText(rec.formSnapshot, null)).toBe('');
    expect(offerValidDaysFieldText(rec.formSnapshot, 14)).toBe('14');
    expect(
      offerValidDaysForSave({
        snapshot: rec.formSnapshot,
        fieldText: '31',
        companyDefault: null,
        touched: false,
      }),
    ).toBe('skip');
    expect(
      offerValidDaysForSave({
        snapshot: rec.formSnapshot,
        fieldText: '31',
        companyDefault: 14,
        touched: false,
      }),
    ).toBe('skip');
    expect(calculationWithOfferValidDays(rec, 14, 14)).toBe(rec);
    const typed = offerValidDaysForSave({
      snapshot: rec.formSnapshot,
      fieldText: '31',
      companyDefault: 14,
      touched: true,
    });
    expect(typed).toBe(31);
    expect(calculationWithOfferValidDays(rec, typed as number, 14).formSnapshot?.offerValidDays).toBe(31);
  });
});
