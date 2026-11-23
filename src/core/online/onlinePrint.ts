/**
 * Tarjous-PDF:n summat palvelimen kokonaissentteinä (online-lähetys).
 * Rivitaulukko tulostuu kuten ennen; summalohko ja ALV-erittely tulevat sopimuksen summista,
 * jotta PDF ja palvelin näyttävät saman loppusumman. Rivien pyöristetty summa voi poiketa
 * loppusummasta enintään muutaman sentin (ALV pyöristetään verokannoittain, ei riveittäin).
 */
import type { OfferVatSummaryRow } from '@/src/core/pdf/offerDocument';
import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';

import type { ContractOfferDraft, ContractTotals } from './contractOffer';

export type OnlineOfferPrint = {
  offerNumber: string;
  version: number;
  totals: ContractTotals;
};

type Row = { label: string; value: string; emphasis?: boolean };

const eur = (cents: number) => cents / 100;

export function onlineVatSummary(online: OnlineOfferPrint, includesVat: boolean): OfferVatSummaryRow[] {
  if (!includesVat) return [];
  return online.totals.vat_breakdown.map((row) => ({
    vatPercent: row.vat_bp / 100,
    net: eur(row.net_cents),
    vat: eur(row.vat_cents),
    gross: eur(row.net_cents + row.vat_cents),
  }));
}

export function onlinePriceBlock(online: OnlineOfferPrint, includesVat: boolean): { includesVat: boolean; rows: Row[] } {
  const t = online.totals;
  const rows: Row[] = [];
  if (t.discount_cents !== 0) {
    rows.push({ label: 'Hinta ennen alennusta (alv 0)', value: formatCurrency(eur(t.net_cents + t.discount_cents)) });
    rows.push({ label: 'Alennus (alv 0)', value: formatCurrency(eur(-t.discount_cents)) });
  }
  if (!includesVat) {
    rows.push({ label: 'Loppusumma (Alv 0 %)', value: formatCurrency(eur(t.net_cents)), emphasis: true });
    return { includesVat: false, rows };
  }
  rows.push({ label: 'Yhteensä alv 0', value: formatCurrency(eur(t.net_cents)) });
  for (const row of t.vat_breakdown) {
    rows.push({ label: `Alv ${formatPercent(row.vat_bp / 100)}`, value: formatCurrency(eur(row.vat_cents)) });
  }
  rows.push({ label: 'Yhteensä sis. alv', value: formatCurrency(eur(t.gross_cents)), emphasis: true });
  return { includesVat: true, rows };
}

/** Maksettava summa euroina (KTV-sivu käyttää samaa lukua kuin sivu 1). */
export function onlinePayable(online: OnlineOfferPrint, includesVat: boolean): number {
  return eur(includesVat ? online.totals.gross_cents : online.totals.net_cents);
}

/** Urakkakortin summat sopimuksen riveistä: rivin piece_rate_cents line_id:n mukaan. */
export type OnlineCardPrint = {
  pieceRateCents: number;
  pieceRateCentsByLine: Record<string, number>;
};

/** Urakkakortin summat valmiista luonnoksesta. */
export function onlineCardPrint(draft: ContractOfferDraft): OnlineCardPrint {
  return {
    pieceRateCents: draft.totals.piece_rate_cents,
    pieceRateCentsByLine: Object.fromEntries(draft.lines.map((line) => [line.line_id, line.piece_rate_cents])),
  };
}
