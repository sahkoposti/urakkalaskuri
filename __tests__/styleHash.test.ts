import {
  computeStyleHashReport,
  pathIndependentFingerprint,
  readBaseline,
} from '../scripts/style-hash';

describe('style hash baseline', () => {
  it('matches the committed baseline on path-independent fingerprints', () => {
    const baseline = readBaseline();
    const current = computeStyleHashReport();
    expect(pathIndependentFingerprint(current)).toEqual(pathIndependentFingerprint(baseline));
  });

  it('is deterministic across two consecutive runs', () => {
    const first = pathIndependentFingerprint(computeStyleHashReport());
    const second = pathIndependentFingerprint(computeStyleHashReport());
    expect(second).toEqual(first);
  });
});
