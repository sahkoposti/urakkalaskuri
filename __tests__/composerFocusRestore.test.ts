import { decideComposerFocusRestore } from '../src/core/wizard/composerFocusRestore';

describe('decideComposerFocusRestore', () => {
  test('first focus with a draft hydrates by restoring the latest draft', () => {
    expect(
      decideComposerFocusRestore({
        latestDraft: { updatedAt: 1000 },
        lastAppliedUpdatedAt: null,
        hydrated: false,
      }),
    ).toBe('restoreDraft');
  });

  test('first focus without a draft hydrates an empty calculation', () => {
    expect(
      decideComposerFocusRestore({
        latestDraft: null,
        lastAppliedUpdatedAt: null,
        hydrated: false,
      }),
    ).toBe('hydrateEmpty');
  });

  test('a new calculation does nothing after the first hydrate', () => {
    expect(
      decideComposerFocusRestore({
        latestDraft: null,
        hydrated: true,
      }),
    ).toBe('none');
  });

  test('stale draft is ignored once the latest revision is already applied', () => {
    // Avaushetken luonnos (updatedAt 1000, 6 m) ei ole syöte.
    // Valmis kirjoitti uuden luonnoksen (3000, 12 m), ja updatedAt-efekti ehti ottaa sen käyttöön.
    const latest = { updatedAt: 3000 };
    expect(
      decideComposerFocusRestore({
        latestDraft: latest,
        lastAppliedUpdatedAt: latest.updatedAt,
        hydrated: true,
      }),
    ).toBe('none');
  });

  test('a newer draft is restored when it has not been applied yet', () => {
    const latest = { updatedAt: 3000 };
    expect(
      decideComposerFocusRestore({
        latestDraft: latest,
        lastAppliedUpdatedAt: 1000,
        hydrated: true,
      }),
    ).toBe('restoreDraft');
  });

  test('customer-screen change is not undone when the latest draft is already applied', () => {
    const latest = { updatedAt: 3000, customerName: 'Uusi Nimi' };
    const capturedWhenScreenOpened = { updatedAt: 1000, customerName: 'Vanha Nimi' };
    expect(
      decideComposerFocusRestore({
        latestDraft: latest,
        lastAppliedUpdatedAt: latest.updatedAt,
        hydrated: true,
      }),
    ).toBe('none');
    expect(latest.customerName).toBe('Uusi Nimi');
    expect(latest.updatedAt).not.toBe(capturedWhenScreenOpened.updatedAt);
  });

  test('editId that is already loaded returns early and does not restore again', () => {
    expect(
      decideComposerFocusRestore({
        routeEditId: 'calc-1',
        loadedEditId: 'calc-1',
        latestDraft: { updatedAt: 3000, editCalculationId: 'calc-1' },
        lastAppliedUpdatedAt: 1000,
        hydrated: true,
      }),
    ).toBe('none');
  });

  test('editId with a draft for the same calculation restores that draft', () => {
    expect(
      decideComposerFocusRestore({
        routeEditId: 'calc-1',
        loadedEditId: null,
        latestDraft: { updatedAt: 1000, editCalculationId: 'calc-1' },
        lastAppliedUpdatedAt: 1000,
        hydrated: false,
      }),
    ).toBe('restoreDraft');
  });

  test('editId without a matching draft loads the saved record', () => {
    expect(
      decideComposerFocusRestore({
        routeEditId: 'calc-1',
        loadedEditId: null,
        latestDraft: null,
        hydrated: false,
      }),
    ).toBe('loadRecord');
    expect(
      decideComposerFocusRestore({
        routeEditId: 'calc-1',
        loadedEditId: null,
        latestDraft: { updatedAt: 1000, editCalculationId: 'muu-laskelma' },
        hydrated: false,
      }),
    ).toBe('loadRecord');
  });
});
