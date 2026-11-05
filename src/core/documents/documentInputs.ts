import type { CalculationRecord } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { readKtvPageIncluded } from '@/src/core/pdf/ktvPageIncluded';
import { readKtvPersons } from '@/src/core/pdf/ktvPersons';
import { printedOfferAmounts } from '@/src/core/pdf/buildPdfContext';
import { readOfferValidDays } from '@/src/core/pdf/offerValidDays';
import { readBusinessVatMode } from '@/src/core/utils/priceDisplay';
import {
  cardHeaderPrices,
  effectiveHuomioitavaa,
  readUrakkakorttiHidePrices,
  readUrakkakorttiMode,
  readUrakkakorttiRivihinnat,
} from '@/src/core/pdf/urakkakorttiCard';

import type { DocumentSummary, TarjousDocumentInputs, UrakkakorttiDocumentInputs } from './types';

export function tarjousDocumentInputs(
  record: CalculationRecord,
  companyValidDays: number,
): TarjousDocumentInputs {
  return {
    offerValidDays: readOfferValidDays(record.formSnapshot, companyValidDays),
    ktvPersons: readKtvPersons(record.formSnapshot),
    ktvPageIncluded: readKtvPageIncluded(record.formSnapshot),
    businessVatMode: readBusinessVatMode(record.formSnapshot),
  };
}

export function urakkakorttiDocumentInputs(record: CalculationRecord): UrakkakorttiDocumentInputs {
  return {
    urakkakorttiMode: readUrakkakorttiMode(record.formSnapshot),
    urakkakorttiHidePrices: readUrakkakorttiHidePrices(record.formSnapshot),
    urakkakorttiHuomioitavaa: effectiveHuomioitavaa(record),
    urakkakorttiRivihinnat: readUrakkakorttiRivihinnat(record.formSnapshot) ?? {},
  };
}

/** Sama loppusumma kuin tarjouksen sivulla 1. */
export function tarjousDocumentTotal(record: CalculationRecord): number {
  return printedOfferAmounts(record, customerFromRecord(record)).gross;
}

/**
 * Dokumenttien listan ja tallennetun yhteenvedon summa on alihankkijan urakka.
 * Kerrointa ei käytetä. Vanhan rivin `summary.total` luetaan sellaisenaan, tätä ei ajeta sille.
 */
export function urakkakorttiDocumentTotal(record: CalculationRecord, _factor?: number): number | null {
  if (readUrakkakorttiHidePrices(record.formSnapshot)) return null;
  return cardHeaderPrices(record, null).alihankkija;
}

export function documentSummary(total: number | null, pages: number): DocumentSummary {
  return { total, pages };
}
