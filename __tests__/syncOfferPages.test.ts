import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import type { FormDefinition } from '../src/core/form/types';
import {
  defaultOfferPageEnabled,
  enabledOfferPageIds,
  pageHasSpecFields,
  syncOfferPages,
  toOfferPageInclusions,
} from '../src/core/pdf/syncOfferPages';

function defaultForm(): FormDefinition {
  return normalizeFormDefinition(createDefaultFormDefinition());
}

function withPage(form: FormDefinition, page: FormDefinition['pages'][number], fields: FormDefinition['fields'] = []) {
  return { ...form, pages: [...form.pages, page], fields: [...form.fields, ...fields] };
}

const specField = (id: string, showOnSummary = true) => ({
  id,
  key: id,
  label: id,
  type: 'number' as const,
  required: false,
  showOnSummary,
});

describe('syncOfferPages', () => {
  it('lists every form page in sortOrder with the title from the form', () => {
    const form = defaultForm();
    const synced = syncOfferPages(form, undefined);
    const sorted = [...form.pages].sort((a, b) => a.sortOrder - b.sortOrder);
    expect(synced.map((p) => p.pageId)).toEqual(sorted.map((p) => p.id));
    expect(synced.map((p) => p.title)).toEqual(sorted.map((p) => p.title));
  });

  it('default rule on the bundled template: pages with specs on, system-only/customer pages off', () => {
    const form = defaultForm();
    const synced = syncOfferPages(form, undefined);
    for (const page of synced) {
      const formPage = form.pages.find((p) => p.id === page.pageId)!;
      expect(page.enabled).toBe(defaultOfferPageEnabled(form, formPage));
    }
    expect(synced.find((p) => p.pageId === 'page_surfaces')?.enabled).toBe(true);
    // Hinnoittelu has € cost specs (matka-ajan kustannus) -> off by default
    expect(synced.find((p) => p.pageId === 'page_pricing')?.enabled).toBe(false);
  });

  it('page with euro-unit spec fields defaults off (internal cost lines)', () => {
    const base = defaultForm();
    const form = withPage(base, { id: 'page_cost', title: 'Kulut', sortOrder: 70, fieldIds: ['e1', 'n1'] }, [
      { ...specField('e1'), unit: '€' },
      specField('n1'),
    ]);
    expect(syncOfferPages(form, undefined).find((p) => p.pageId === 'page_cost')?.enabled).toBe(false);
  });

  it('new page gets its default; stored choices are kept', () => {
    const base = defaultForm();
    const stored = toOfferPageInclusions(syncOfferPages(base, undefined)).map((p) => ({ ...p, enabled: false }));
    const form = withPage(base, { id: 'page_new', title: 'Uusi', sortOrder: 999, fieldIds: ['f_new'] }, [
      specField('f_new'),
    ]);
    const synced = syncOfferPages(form, { offerPages: stored });
    expect(synced.find((p) => p.pageId === 'page_new')?.enabled).toBe(true);
    expect(synced.filter((p) => p.pageId !== 'page_new').every((p) => !p.enabled)).toBe(true);
  });

  it('removed page disappears; renamed page shows the new title and keeps its choice', () => {
    const base = defaultForm();
    const stored = [
      { pageId: 'page_surfaces', enabled: false },
      { pageId: 'page_deleted', enabled: true },
    ];
    const form = {
      ...base,
      pages: base.pages.map((p) => (p.id === 'page_surfaces' ? { ...p, title: 'Pinta-alat' } : p)),
    };
    const synced = syncOfferPages(form, { offerPages: stored });
    expect(synced.some((p) => p.pageId === 'page_deleted')).toBe(false);
    const surfaces = synced.find((p) => p.pageId === 'page_surfaces')!;
    expect(surfaces.title).toBe('Pinta-alat');
    expect(surfaces.enabled).toBe(false);
  });

  it('customer and materials system pages default off even with spec fields', () => {
    const base = defaultForm();
    const form = withPage(
      withPage(base, { id: 'page_customer', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: ['c1'] }, [
        specField('c1'),
      ]),
      { id: 'page_mat', title: 'Materiaalit', sortOrder: 50, system: 'materials', fieldIds: ['m1'] },
      [specField('m1')],
    );
    const synced = syncOfferPages(form, undefined);
    expect(synced.find((p) => p.pageId === 'page_customer')?.enabled).toBe(false);
    expect(synced.find((p) => p.pageId === 'page_mat')?.enabled).toBe(false);
  });

  it('page with only system fields or only hidden fields defaults off', () => {
    const base = defaultForm();
    const systemField = base.fields.find((f) => f.systemKey === 'kokonaishinta')!;
    const form = withPage(
      withPage(base, { id: 'page_sys', title: 'Hinnat', sortOrder: 60, fieldIds: [systemField.id] }),
      { id: 'page_hidden', title: 'Piilo', sortOrder: 61, fieldIds: ['h1'] },
      [specField('h1', false)],
    );
    expect(pageHasSpecFields(form, 'page_sys')).toBe(false);
    const synced = syncOfferPages(form, undefined);
    expect(synced.find((p) => p.pageId === 'page_sys')?.enabled).toBe(false);
    expect(synced.find((p) => p.pageId === 'page_hidden')?.enabled).toBe(false);
  });

  it('enabledOfferPageIds returns enabled ids in order', () => {
    const form = defaultForm();
    const ids = enabledOfferPageIds(form, { offerPages: [{ pageId: 'page_surfaces', enabled: false }] });
    expect(ids).not.toContain('page_surfaces');
  });
});
