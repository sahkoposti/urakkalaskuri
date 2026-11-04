import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import {
  calendarDaysBetween,
  daysTextForExpiryDate,
  expiryDateTextForDays,
  OFFER_EXPIRY_DATE_INVALID_MESSAGE,
  offerExpiryDateProblem,
  parseOfferValidDateInput,
} from '../src/core/pdf/offerExpiryDate';
import { calculationWithOfferValidDays } from '../src/core/pdf/offerValidDays';
import { formatFinnishDate, validUntil } from '../src/core/pdf/validUntil';
import { input, record } from './pdfFixtures';

const offerDate = new Date(2026, 9, 10);

describe('offerExpiryDate', () => {
  it('maps 1 and 365 days onto the same calendar date and back', () => {
    for (const days of [1, 365]) {
      const until = validUntil(offerDate, days);
      const text = formatFinnishDate(until);
      expect(parseOfferValidDateInput(text, offerDate)).toBe(days);
      expect(expiryDateTextForDays(String(days), offerDate, '')).toBe(text);
      expect(daysTextForExpiryDate(text, offerDate, '31')).toBe(String(days));
      expect(calendarDaysBetween(offerDate, until)).toBe(days);
    }
    expect(formatFinnishDate(validUntil(offerDate, 1))).toBe('11.10.2026');
    expect(formatFinnishDate(validUntil(offerDate, 365))).toBe('10.10.2027');
    expect(expiryDateTextForDays('365', offerDate, '')).toBe('10.10.2027');
  });

  it('shows the same unpadded date as the PDF and accepts a padded entry', () => {
    const early = new Date(2026, 0, 5);
    expect(formatFinnishDate(validUntil(early, 1))).toBe('6.1.2026');
    expect(expiryDateTextForDays('1', early, '')).toBe('6.1.2026');
    expect(parseOfferValidDateInput('06.01.2026', early)).toBe(1);
    expect(parseOfferValidDateInput('6.1.2026', early)).toBe(1);

    const days = parseOfferValidDateInput('24.11.2026', offerDate);
    expect(days).toBe(45);
    const saved = calculationWithOfferValidDays(record({}), days as number, 31);
    expect(saved.formSnapshot?.offerValidDays).toBe(45);
    expect(JSON.stringify(saved.formSnapshot)).not.toContain('ktvPageIncluded');
    expect(Object.keys(saved.formSnapshot ?? {})).not.toContain('offerValidUntil');
    const ctx = buildPdfContext(input(saved, { generatedAt: offerDate }));
    expect(ctx.offerInfo.find((row) => row.label === 'Voimassa')?.value).toBe('24.11.2026');
  });

  it('does not store the company default when the date matches that many days', () => {
    const text = formatFinnishDate(validUntil(offerDate, 31));
    const days = parseOfferValidDateInput(text, offerDate);
    expect(days).toBe(31);
    const source = record({});
    const saved = calculationWithOfferValidDays(source, days as number, 31);
    expect(saved).toBe(source);
    expect(saved.formSnapshot?.offerValidDays).toBeUndefined();
  });

  it('crosses a leap day and rejects 29.02 on a non-leap year', () => {
    const leapEve = new Date(2028, 1, 28);
    expect(formatFinnishDate(validUntil(leapEve, 1))).toBe('29.2.2028');
    expect(expiryDateTextForDays('1', leapEve, '')).toBe('29.2.2028');
    expect(parseOfferValidDateInput('29.02.2028', leapEve)).toBe(1);
    expect(parseOfferValidDateInput('29.02.2027', new Date(2027, 1, 28))).toBe('invalid');
    expect(parseOfferValidDateInput('01.03.2027', new Date(2027, 1, 28))).toBe(1);
    const year = validUntil(leapEve, 365);
    expect(parseOfferValidDateInput(formatFinnishDate(year), leapEve)).toBe(365);
  });

  it('rejects past dates, the offer date itself, 366 days and broken input', () => {
    expect(parseOfferValidDateInput('09.10.2026', offerDate)).toBe('invalid');
    expect(parseOfferValidDateInput('10.10.2026', offerDate)).toBe('invalid');
    expect(parseOfferValidDateInput(formatFinnishDate(validUntil(offerDate, 366)), offerDate)).toBe('invalid');
    for (const raw of ['', '24/11/2026', '2026-11-24', '32.10.2026', '31.04.2026', '00.10.2026', '24.13.2026', 'abc']) {
      expect(parseOfferValidDateInput(raw, offerDate)).toBe('invalid');
    }
    expect(daysTextForExpiryDate('eilen', offerDate, '14')).toBe('14');
    expect(expiryDateTextForDays('0', offerDate, '11.10.2026')).toBe('11.10.2026');
  });

  it('explains an invalid date in Finnish and stays quiet before the days have loaded', () => {
    expect(offerExpiryDateProblem('', offerDate, '')).toBeNull();
    expect(offerExpiryDateProblem('', offerDate, 'abc')).toBeNull();
    expect(offerExpiryDateProblem('', offerDate, '31')).toBe(OFFER_EXPIRY_DATE_INVALID_MESSAGE);
    expect(offerExpiryDateProblem('09.10.2026', offerDate, '31')).toBe(OFFER_EXPIRY_DATE_INVALID_MESSAGE);
    expect(offerExpiryDateProblem('11.10.2026', offerDate, '1')).toBeNull();
    expect(offerExpiryDateProblem('24.10.2026', offerDate, '1')).toBe(OFFER_EXPIRY_DATE_INVALID_MESSAGE);
  });

  it('crosses the spring daylight-saving change and a month end', () => {
    const beforeDst = new Date(2027, 2, 25);
    expect(formatFinnishDate(validUntil(beforeDst, 10))).toBe('4.4.2027');
    expect(parseOfferValidDateInput('4.4.2027', beforeDst)).toBe(10);
    expect(parseOfferValidDateInput('04.04.2027', beforeDst)).toBe(10);
    expect(expiryDateTextForDays('10', beforeDst, '')).toBe('4.4.2027');
    expect(calendarDaysBetween(beforeDst, validUntil(beforeDst, 10))).toBe(10);

    const monthEnd = new Date(2026, 0, 31);
    expect(formatFinnishDate(validUntil(monthEnd, 30))).toBe('2.3.2026');
    expect(parseOfferValidDateInput('2.3.2026', monthEnd)).toBe(30);
    expect(parseOfferValidDateInput('02.03.2026', monthEnd)).toBe(30);
    expect(calendarDaysBetween(monthEnd, validUntil(monthEnd, 30))).toBe(30);
  });
});
