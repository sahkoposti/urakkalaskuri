import type { TextInputKind } from '@/src/components/textInputProps';

/**
 * Dokumentit-lomakkeiden tekstikenttien lajit.
 * Tarjous- ja urakkakorttilomake lukevat tämän taulun, jotta näppäimistö
 * tulee textInputPropsFor-funktiosta eikä pelkästä keyboardType-arvosta.
 * Asiakkaan ja myyjän kentät eivät ole näillä lomakkeilla.
 */
export const OFFER_EXPORT_FIELD_KINDS = {
  ktvPersons: 'integer',
  validDays: 'integer',
  validDate: 'code',
} as const satisfies Record<string, TextInputKind>;

export const CARD_EXPORT_FIELD_KINDS = {
  rowPrice: 'decimal',
  huomio: 'sentence',
} as const satisfies Record<string, TextInputKind>;
