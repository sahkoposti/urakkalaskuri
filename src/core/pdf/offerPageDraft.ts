import type { FormDefinition } from '@/src/core/form/types';

import { syncOfferPages, toOfferPageInclusions } from './syncOfferPages';
import type { OfferStructureSettings, SyncedOfferPage } from './types';

export type StructureOfferPageDraft = {
  structureId: string;
  structureName: string;
  pages: SyncedOfferPage[];
  /** Tallennettu rakennekohtainen Lisätiedot. Tätä ei muokata sivunäytöllä. */
  additionalInfoText: string;
};

type StructureWithForm = {
  id: string;
  name: string;
  form?: FormDefinition;
};

/** Rakenteen sivuvalinnat lomakkeeseen synkronoituina. Lisätiedot säilyy mukana tallennusta varten. */
export function structureOfferPageDraft(
  structure: StructureWithForm,
  settings: OfferStructureSettings,
): StructureOfferPageDraft | null {
  if (!structure.form) return null;
  return {
    structureId: structure.id,
    structureName: structure.name,
    pages: syncOfferPages(structure.form, settings),
    additionalInfoText: settings.additionalInfoText,
  };
}

export function toggleStructureOfferPage(
  draft: StructureOfferPageDraft,
  pageId: string,
  enabled: boolean,
): StructureOfferPageDraft {
  return {
    ...draft,
    pages: draft.pages.map((page) => (page.pageId === pageId ? { ...page, enabled } : page)),
  };
}

/** Tallennus vaihtaa vain `offerPages`. `additionalInfoText` jää ennalleen. */
export function offerStructureSettingsFromPageDraft(draft: StructureOfferPageDraft): OfferStructureSettings {
  return {
    additionalInfoText: draft.additionalInfoText,
    offerPages: toOfferPageInclusions(draft.pages),
  };
}
