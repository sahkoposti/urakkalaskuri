import { buildPdfFileName, formatIsoDate, sanitizeFileNamePart } from '../src/core/pdf/pdfFileName';

describe('buildPdfFileName', () => {
  const date = new Date(2026, 8, 9); // 9.9.2026 paikallista aikaa

  it('builds offer file name per plan §10', () => {
    expect(buildPdfFileName({ kind: 'Tarjous', offerNumber: 1042, customerName: 'Mäkinen', date })).toBe(
      'Tarjous_1042_Mäkinen_2026-09-09.pdf',
    );
  });

  it('builds urakkakortti file name without number even if given', () => {
    expect(buildPdfFileName({ kind: 'Urakkakortti', offerNumber: 1042, customerName: 'Mäkinen', date })).toBe(
      'Urakkakortti_Mäkinen_2026-09-09.pdf',
    );
  });

  it('keeps Finnish and Swedish letters', () => {
    expect(buildPdfFileName({ kind: 'Tarjous', offerNumber: 7, customerName: 'Åström Öhman Ärkkilä', date })).toBe(
      'Tarjous_7_Åström_Öhman_Ärkkilä_2026-09-09.pdf',
    );
  });

  it('strips unsafe characters', () => {
    expect(sanitizeFileNamePart('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(sanitizeFileNamePart('../../etc/passwd')).toBe('etc_passwd');
    expect(sanitizeFileNamePart('Oy  Yritys & Co.\n')).toBe('Oy_Yritys_Co');
    expect(sanitizeFileNamePart('Virtanen-Koski')).toBe('Virtanen-Koski');
  });

  it('omits empty customer name and invalid offer numbers', () => {
    expect(buildPdfFileName({ kind: 'Tarjous', customerName: '  ', date })).toBe('Tarjous_2026-09-09.pdf');
    expect(buildPdfFileName({ kind: 'Tarjous', offerNumber: 0, customerName: null, date })).toBe('Tarjous_2026-09-09.pdf');
    expect(buildPdfFileName({ kind: 'Tarjous', offerNumber: Number.NaN, date })).toBe('Tarjous_2026-09-09.pdf');
  });

  it('limits very long names', () => {
    const name = sanitizeFileNamePart('x'.repeat(200));
    expect(name.length).toBe(60);
  });

  it('formats date as YYYY-MM-DD with zero padding', () => {
    expect(formatIsoDate(new Date(2027, 0, 1))).toBe('2027-01-01');
    expect(formatIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});
