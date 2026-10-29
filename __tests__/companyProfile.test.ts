import {
  cleanCompanyProfile,
  companyProfilesEqual,
  defaultCompanyProfile,
  normalizeCompanyProfile,
  parseStoredCompanyProfile,
} from '../src/core/company/defaultCompany';

describe('company profile defaults', () => {
  it('returns ColoRajaton defaults when nothing is stored', () => {
    const p = parseStoredCompanyProfile(null);
    expect(p).toEqual({ ...defaultCompanyProfile });
    expect(p.companyName).toBe('ColoRajaton Oy');
    expect(p.businessId).toBe('3224017-2');
    expect(p.logoUri).toBeUndefined();
  });

  it('falls back to defaults on corrupt JSON or wrong shape', () => {
    expect(parseStoredCompanyProfile('{not json')).toEqual({ ...defaultCompanyProfile });
    expect(parseStoredCompanyProfile('[1,2]')).toEqual({ ...defaultCompanyProfile });
    expect(parseStoredCompanyProfile('"text"')).toEqual({ ...defaultCompanyProfile });
    expect(normalizeCompanyProfile({ phone: 123, email: null })).toEqual({ ...defaultCompanyProfile });
  });

  it('merges partial stored values with defaults', () => {
    const p = parseStoredCompanyProfile(JSON.stringify({ phone: '+358 1', sellerName: 'Myyjä' }));
    expect(p.phone).toBe('+358 1');
    expect(p.sellerName).toBe('Myyjä');
    expect(p.companyName).toBe('ColoRajaton Oy');
  });

  it('keeps empty strings (user cleared the field)', () => {
    const p = parseStoredCompanyProfile(JSON.stringify({ website: '', email: '' }));
    expect(p.website).toBe('');
    expect(p.email).toBe('');
  });

  it('keeps a non-empty logoUri, drops an empty one', () => {
    expect(normalizeCompanyProfile({ logoUri: ' file:///x.png ' }).logoUri).toBe('file:///x.png');
    expect(normalizeCompanyProfile({ logoUri: '  ' }).logoUri).toBeUndefined();
  });

  it('cleanCompanyProfile trims and ignores unknown keys', () => {
    const cleaned = cleanCompanyProfile({ ...defaultCompanyProfile, phone: '  040  ', extra: 'x' } as never);
    expect(cleaned.phone).toBe('040');
    expect('extra' in cleaned).toBe(false);
  });

  it('companyProfilesEqual compares all fields', () => {
    const a = { ...defaultCompanyProfile };
    expect(companyProfilesEqual(a, { ...a })).toBe(true);
    expect(companyProfilesEqual(a, { ...a, email: 'x' })).toBe(false);
    expect(companyProfilesEqual(a, { ...a, logoUri: 'y' })).toBe(false);
  });
});
