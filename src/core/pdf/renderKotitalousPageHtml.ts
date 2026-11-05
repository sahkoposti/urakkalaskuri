import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';

import type { TarjousPdfContext } from './buildPdfContext';
import { escapeHtml, escapeMultiline } from './escapeHtml';
import { KTV_DEFAULT_NOTE, kotitalousDeduction } from './kotitalousDeduction';
import { isValidKtvPersons } from './ktvPersons';
import type { KtvSettings } from './types';

const DEFAULT_TOTAL_LABEL = 'Yhteensä sis. alv';

/** Oletushuomautus. Yrityksen oma teksti ei kulje tämän kautta. */
export function ktvDefaultNote(persons: number): string {
  if (persons <= 1) return KTV_DEFAULT_NOTE;
  return KTV_DEFAULT_NOTE.replace('yhdelle henkilölle', `${persons} henkilölle`);
}

/**
 * Prosentti, enimmäismäärä ja omavastuu yrityksen asetuksista (ei kovakoodattu).
 * Sanamuoto yhdessä paikassa (Easoft-tarjous 10244).
 */
export function ktvRateSentence(settings: Pick<KtvSettings, 'ratePercent' | 'capEur' | 'deductibleEur'>): string {
  return (
    `Vähennystä saa arvonlisäverollisesta työn osuudesta ${formatPercent(settings.ratePercent)}, ` +
    `max ${formatCurrency(settings.capEur)} / henkilö vuodessa; ` +
    `omavastuu ${formatCurrency(settings.deductibleEur)} / henkilö vuodessa.`
  );
}

const eur = formatCurrency;
const pct = formatPercent;
const minus = (amount: string) => `\u2212${amount}`;

/** Näytetään vain, kun valittu n on suurempi kuin vähennykseen tarvittava määrä. */
export function ktvPersonsUsedHint(personsUsed: number, persons: number): string {
  if (personsUsed >= persons) return '';
  if (personsUsed === 1) {
    return 'Laskelmassa on käytetty yhden henkilön omavastuuta ja enimmäismäärää, koska vähennys ei vaadi useampaa.';
  }
  return `Laskelmassa on käytetty ${personsUsed} henkilön omavastuuta ja enimmäismäärää, koska vähennys ei vaadi useampaa.`;
}

function ktvRow(label: string, basis: string, amount: string, className = ''): string {
  const cls = className ? ` class="${className}"` : '';
  return `<tr${cls}><td>${escapeHtml(label)}</td><td class="basis">${escapeHtml(basis)}</td><td class="num">${escapeHtml(amount)}</td></tr>`;
}

function ktvBlock(title: string, rows: string): string {
  return `<div class="ktv-block"><table class="ktv-table"><colgroup><col /><col class="c-basis" /><col class="c-amount" /></colgroup><thead><tr><th>${escapeHtml(title)}</th><th class="num">Peruste</th><th class="num">Summa</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

/**
 * Kotitalousvähennyssivu (suunnitelma §1.6). Viimeinen sivu, oma sivunvaihto.
 * Vain yksityisasiakas ilman käänteistä ALV:ta (ctx.ktv puuttuu muille → tyhjä merkkijono).
 * Luvut tulevat kotitalousDeductionista. Tällä sivulla ei ole henkilökohtaista jakoa.
 */
export function renderKotitalousPageHtml(ctx: Pick<TarjousPdfContext, 'ktv'>): string {
  const ktv = ctx.ktv;
  if (!ktv) return '';
  const persons = ktv.persons == null ? 1 : ktv.persons;
  if (!isValidKtvPersons(persons)) {
    throw new Error('Henkilöiden määrä on kokonaisluku väliltä 1–10.');
  }
  const result = kotitalousDeduction({
    totalPriceVat: ktv.totalPriceVat,
    materialsVat: ktv.materialsVat,
    settings: ktv.settings,
    persons,
  });
  const s = result.settings;
  const n = result.persons;
  const k = result.personsUsed;
  const totalLabel = ktv.totalLabel.trim() || DEFAULT_TOTAL_LABEL;
  const customNote = ktv.footnoteText.trim();
  const note = customNote || ktvDefaultNote(n);
  const hint = ktvPersonsUsedHint(k, n);
  const price = ktvBlock(
    '1. Tarjouksen hinta',
    [
      ktvRow(totalLabel, 'sivun 1 loppusumma', eur(ktv.totalPriceVat)),
      ktvRow('josta materiaalit (sis. alv)', 'ei vähennyskelpoinen', eur(result.materialsShareVatIncluded), 'sub minor'),
      ktvRow('josta työn osuus (sis. alv)', 'vähennyksen pohja', eur(result.workShareVatIncluded), 'sub'),
    ].join(''),
  );
  const deduction = ktvBlock(
    '2. Vähennyksen laskenta',
    [
      ktvRow(
        `Kotitalousvähennys ${pct(s.ratePercent)} työn osuudesta`,
        `${pct(s.ratePercent)} × ${eur(result.workShareVatIncluded)}`,
        eur(result.grossDeduction),
      ),
      ktvRow(`Omavastuu (${k} hlö)`, `${k} × ${eur(s.deductibleEur)}`, minus(eur(k * s.deductibleEur))),
      ktvRow(`Arvioitu kotitalousvähennys (${k} hlö)`, '', eur(result.deductionAmount), 'result'),
    ].join(''),
  );
  const hintHtml = hint ? `<p class="ktv-hint">${escapeHtml(hint)}</p>\n` : '';
  return `<section class="ktv-page page-break">
<h2 class="ktv-title">Kotitalousvähennyslaskelma (${n} hlö)</h2>
<p class="ktv-rate-sentence">${escapeHtml(ktvRateSentence(s))}</p>
${price}
${deduction}
${hintHtml}<p class="ktv-note">${escapeMultiline(note)}</p>
</section>`;
}
