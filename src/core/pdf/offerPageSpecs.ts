import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import { buildCalculationFormulaContext } from '@/src/core/form/calculationFormulaContext';
import { sortedPages } from '@/src/core/form/formDefinitionHelpers';
import { lineFormSnapshot } from '@/src/core/form/formSummaryHelpers';
import type { FormDefinition } from '@/src/core/form/types';
import type { AppSettings, FormSnapshot, Product, StructureLine } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
import type { ProductStructure } from '@/src/core/structure/types';
import { displayWorkDurationText } from '@/src/core/utils/formatters';

export type SpecRow = { label: string; value: string };

export type SpecCard = {
  /** Lomakesivun id (null = sivua ei löydy nykyisestä lomakkeesta). */
  pageId: string | null;
  title: string;
  rows: SpecRow[];
};

/**
 * Rivin speksit: tallennettu snapshot (R8: ensisijainen) tai elävä laskenta nykyisellä lomakkeella.
 * Sama logiikka kuin erittelysivun LineDetail.
 */
export function lineSpecSnapshot(
  line: StructureLine,
  structure: ProductStructure | undefined,
  products: Product[],
  settings: AppSettings,
  reverseVat: boolean,
  travelTimeHoursOneWay?: number,
): FormSnapshot | undefined {
  const structureProducts = products.filter((product) => productBelongsToStructure(product, line.structureId));
  if (line.snapshot?.fields?.length) return line.snapshot;
  if (!structure) return undefined;
  const context = previewFormContext(
    structure.form,
    line.fieldValues ?? {},
    [],
    structureProducts,
    settingsForStructure(settings, structure),
    undefined,
    reverseVat,
    buildCalculationFormulaContext({ travelTimeHoursOneWay }),
  );
  return lineFormSnapshot(line, structure.form, structureProducts, context);
}

/**
 * Ryhmittelee snapshotin rivit lomakesivuittain.
 * Sivu tunnistetaan ensin kentän avaimesta (kestää sivun uudelleennimeämisen), sitten otsikosta.
 * Järjestys = lomakkeen sortOrder; tuntemattomat sivut perään snapshotin järjestyksessä.
 * Tyhjät sivut jätetään pois.
 */
export function specCardsFromSnapshot(snapshot: FormSnapshot | undefined, form: FormDefinition | undefined): SpecCard[] {
  if (!snapshot?.fields?.length) return [];
  const pages = form ? sortedPages(form) : [];
  const keyToPage = new Map<string, string>();
  if (form) {
    const idToKey = new Map(form.fields.map((field) => [field.id, field.key]));
    for (const page of pages) {
      for (const fieldId of page.fieldIds) {
        const key = idToKey.get(fieldId);
        if (key && !keyToPage.has(key)) keyToPage.set(key, page.id);
      }
    }
  }
  const titleToPage = new Map(pages.map((page) => [displayWorkDurationText(page.title), page.id]));

  const cards = new Map<string, SpecCard>();
  for (const field of snapshot.fields) {
    const pageId = keyToPage.get(field.key) ?? (field.pageTitle ? titleToPage.get(field.pageTitle) : undefined) ?? null;
    const groupKey = pageId ?? `title:${field.pageTitle ?? ''}`;
    let card = cards.get(groupKey);
    if (!card) {
      const page = pageId ? pages.find((item) => item.id === pageId) : undefined;
      card = {
        pageId,
        title: page ? displayWorkDurationText(page.title) : (field.pageTitle ?? ''),
        rows: [],
      };
      cards.set(groupKey, card);
    }
    card.rows.push({ label: field.label, value: field.value });
  }
  const order = new Map(pages.map((page, index) => [page.id, index]));
  return [...cards.values()]
    .filter((card) => card.rows.length > 0)
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      const oa = a.card.pageId != null ? (order.get(a.card.pageId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      const ob = b.card.pageId != null ? (order.get(b.card.pageId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
      return oa - ob || a.index - b.index;
    })
    .map(({ card }) => card);
}

/** Tarjoukseen valitut kortit: vain sivut, jotka on kytketty päälle (tuntematon sivu → pois). */
export function filterOfferCards(cards: SpecCard[], enabledPageIds: ReadonlySet<string>): SpecCard[] {
  return cards.filter((card) => card.pageId != null && enabledPageIds.has(card.pageId));
}
