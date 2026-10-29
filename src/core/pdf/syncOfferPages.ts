import { fieldsForPage, isCustomerFormPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormPage } from '@/src/core/form/types';

import type { OfferPageInclusion, OfferStructureSettings, SyncedOfferPage } from './types';

/** Sivulla on vähintään yksi speksi: showOnSummary, ei järjestelmäkenttä, ei otsikko. */
export function pageHasSpecFields(form: FormDefinition, pageId: string): boolean {
  return fieldsForPage(form, pageId).some(
    (field) => field.type !== 'section' && !isSystemField(field) && field.showOnSummary,
  );
}

/** Sivulla on euromääräinen speksi (esim. "Josta matka-ajan kustannus (ALV 0)"): sisäinen kustannusrivi. */
export function pageHasEuroSpecFields(form: FormDefinition, pageId: string): boolean {
  return fieldsForPage(form, pageId).some(
    (field) => field.type !== 'section' && !isSystemField(field) && field.showOnSummary && field.unit === '€',
  );
}

/**
 * Oletus kun sivu ilmestyy listaan (suunnitelma §3):
 * asiakassivu pois, materiaalisivu (system: materials) pois, vain järjestelmäkenttiä → pois,
 * muuten päällä jos sivulla on vähintään yksi speksi.
 * Lisäsääntö (Koodari 29.10.2026, turvallinen oletus): sivu jolla on €-yksikköisiä speksejä → pois,
 * jotta sisäiset kustannusrivit eivät päädy asiakkaan tarjoukseen ilman, että käyttäjä valitsee ne.
 * Hinnat tulevat tarjoukseen hintaerittelystä. Käyttäjä voi kytkeä sivun päälle.
 */
export function defaultOfferPageEnabled(form: FormDefinition, page: FormPage): boolean {
  if (isCustomerFormPage(page)) return false;
  if (page.system === 'materials') return false;
  if (pageHasEuroSpecFields(form, page.id)) return false;
  return pageHasSpecFields(form, page.id);
}

/**
 * Synkronoi tallennetut sivuvalinnat lomakkeeseen:
 * uusi sivu → oletus; poistettu sivu → pois listasta; otsikko aina lomakkeesta; järjestys = sortOrder.
 */
export function syncOfferPages(
  form: FormDefinition,
  settings: Pick<OfferStructureSettings, 'offerPages'> | undefined,
): SyncedOfferPage[] {
  const stored = new Map<string, boolean>();
  for (const item of settings?.offerPages ?? []) stored.set(item.pageId, item.enabled);
  return sortedPages(form).map((page) => {
    const defaultEnabled = defaultOfferPageEnabled(form, page);
    return {
      pageId: page.id,
      title: page.title,
      enabled: stored.has(page.id) ? Boolean(stored.get(page.id)) : defaultEnabled,
      defaultEnabled,
    };
  });
}

/** Tallennettava muoto (ilman otsikoita). */
export function toOfferPageInclusions(pages: SyncedOfferPage[]): OfferPageInclusion[] {
  return pages.map(({ pageId, enabled }) => ({ pageId, enabled }));
}

/** Tulostettavien sivujen id:t järjestyksessä. */
export function enabledOfferPageIds(
  form: FormDefinition,
  settings: Pick<OfferStructureSettings, 'offerPages'> | undefined,
): string[] {
  return syncOfferPages(form, settings)
    .filter((page) => page.enabled)
    .map((page) => page.pageId);
}
