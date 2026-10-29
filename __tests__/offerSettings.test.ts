import {
  DEFAULT_KHV_SETTINGS,
  defaultOfferCompanySettings,
  normalizeKhvSettings,
  normalizeOfferCompanySettings,
  parseStoredOfferCompanySettings,
  parseStoredOfferStructureSettings,
} from '../src/core/pdf/defaultOfferSettings';
import { offerStructureSettingsKey } from '../src/core/pdf/types';

describe('offer company settings', () => {
  it('defaults: validity 31, numbering 10285, KHV 40 % / 150 € / 2100 €', () => {
    const s = parseStoredOfferCompanySettings(null);
    expect(s.offerValidDays).toBe(31);
    expect(s.offerNumberStart).toBe(10285);
    expect(s.khv).toEqual({ ratePercent: 40, deductibleEur: 150, capEur: 2100 });
    expect(s.khvFootnoteText).toBe('');
    expect(s).toEqual({ ...defaultOfferCompanySettings, khv: { ...DEFAULT_KHV_SETTINGS } });
  });

  it('corrupt JSON or wrong shape falls back to defaults', () => {
    expect(parseStoredOfferCompanySettings('{x')).toEqual(normalizeOfferCompanySettings(undefined));
    expect(parseStoredOfferCompanySettings('[]')).toEqual(normalizeOfferCompanySettings(undefined));
    expect(
      normalizeOfferCompanySettings({ offerValidDays: -1, offerNumberStart: 0.5, khv: 'x' }),
    ).toEqual(normalizeOfferCompanySettings(undefined));
  });

  it('keeps stored values (configurable, not hardcoded)', () => {
    const s = normalizeOfferCompanySettings({
      offerValidDays: 14,
      offerNumberStart: 20000,
      khv: { ratePercent: 35, deductibleEur: 100, capEur: 1600 },
      khvFootnoteText: 'Oma huomautus',
    });
    expect(s).toEqual({
      offerValidDays: 14,
      offerNumberStart: 20000,
      khv: { ratePercent: 35, deductibleEur: 100, capEur: 1600 },
      khvFootnoteText: 'Oma huomautus',
    });
  });

  it('KHV: partial merge, decimal comma, rate above 100 rejected', () => {
    expect(normalizeKhvSettings({ ratePercent: '37,5' })).toEqual({ ratePercent: 37.5, deductibleEur: 150, capEur: 2100 });
    expect(normalizeKhvSettings({ ratePercent: 150 }).ratePercent).toBe(40);
    expect(normalizeKhvSettings({ capEur: 4200 }).capEur).toBe(4200);
  });
});

describe('offer structure settings', () => {
  it('defaults to empty Lisätiedot and no stored page choices', () => {
    expect(parseStoredOfferStructureSettings(undefined)).toEqual({ additionalInfoText: '', offerPages: [] });
  });

  it('drops invalid and duplicate page rows', () => {
    const s = parseStoredOfferStructureSettings(
      JSON.stringify({
        additionalInfoText: 'Hinta sisältää telineet.',
        offerPages: [
          { pageId: 'a', enabled: true },
          { pageId: 'a', enabled: false },
          { pageId: '', enabled: true },
          { pageId: 'b', enabled: 'yes' },
          { pageId: 'c', enabled: false },
        ],
      }),
    );
    expect(s.additionalInfoText).toBe('Hinta sisältää telineet.');
    expect(s.offerPages).toEqual([
      { pageId: 'a', enabled: true },
      { pageId: 'c', enabled: false },
    ]);
  });

  it('settings key is per structure', () => {
    expect(offerStructureSettingsKey('julkisivu')).toBe('offer_settings:julkisivu');
  });
});
