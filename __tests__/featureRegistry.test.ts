import { FEATURES, type FeatureId, isFeatureEnabled } from '../src/features/registry';

describe('feature registry', () => {
  it('has unique feature ids', () => {
    const ids = FEATURES.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('enables every registered feature', () => {
    for (const feature of FEATURES) {
      expect(feature.enabled).toBe(true);
    }
  });

  it('isFeatureEnabled reflects enabled features only', () => {
    for (const feature of FEATURES) {
      expect(isFeatureEnabled(feature.id)).toBe(true);
    }
    expect(isFeatureEnabled('asiakkaat')).toBe(true);
    expect(isFeatureEnabled('unknown' as FeatureId)).toBe(false);
  });
});
