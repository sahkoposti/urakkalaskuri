import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import {
  offerStructureSettingsFromPageDraft,
  structureOfferPageDraft,
  toggleStructureOfferPage,
} from '../src/core/pdf/offerPageDraft';

describe('per-structure offer pages', () => {
  const form = createMinimalFormDefinition();
  const stored = {
    additionalInfoText: 'Vanha rakennekohtainen teksti',
    offerPages: [{ pageId: form.pages[0]?.id ?? 'missing', enabled: false }],
  };

  it('keeps a saved page switch editable and does not touch Lisätiedot', () => {
    const draft = structureOfferPageDraft({ id: 's1', name: 'Ulkomaalaus', form }, stored);
    expect(draft).not.toBeNull();
    const first = draft!.pages[0];
    expect(first.enabled).toBe(first.pageId === stored.offerPages[0].pageId ? false : first.defaultEnabled);
    const toggled = toggleStructureOfferPage(draft!, first.pageId, !first.enabled);
    const saved = offerStructureSettingsFromPageDraft(toggled);
    expect(saved.additionalInfoText).toBe('Vanha rakennekohtainen teksti');
    expect(saved.offerPages.find((page) => page.pageId === first.pageId)?.enabled).toBe(!first.enabled);
    expect(saved.offerPages).toHaveLength(toggled.pages.length);
    const roundTrip = structureOfferPageDraft({ id: 's1', name: 'Ulkomaalaus', form }, saved);
    expect(roundTrip?.pages.map((page) => page.enabled)).toEqual(toggled.pages.map((page) => page.enabled));
    expect(roundTrip?.additionalInfoText).toBe(stored.additionalInfoText);
  });

  it('returns null when the structure has no form', () => {
    expect(structureOfferPageDraft({ id: 's1', name: 'Ilman lomaketta' }, stored)).toBeNull();
  });
});
