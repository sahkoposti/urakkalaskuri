import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';

import type { TarjousPdfContext } from './buildPdfContext';
import { escapeHtml, escapeMultiline } from './escapeHtml';
import { KTV_DEFAULT_NOTE, kotitalousDeduction } from './kotitalousDeduction';
import { isValidKtvPersons } from './ktvPersons';
import type { KtvSettings } from './types';

/** Kiinteä teksti yhdelle henkilölle. n > 1 vaihtaa sanan "n henkilölle". */
export const KTV_ONE_PERSON_LINE = 'Laskelma on arvio yhdelle henkilölle.';

/** Oletushuomautus. Yrityksen oma teksti ei kulje tämän kautta. */
export function ktvDefaultNote(persons: number): string {
  if (persons <= 1) return KTV_DEFAULT_NOTE;
  return KTV_DEFAULT_NOTE.replace('yhdelle henkilölle', `${persons} henkilölle`);
}

export function ktvPersonsLine(persons: number): string {
  if (persons <= 1) return KTV_ONE_PERSON_LINE;
  return `Laskelma on arvio ${persons} henkilölle.`;
}

/**
 * Prosentti, enimmäismäärä ja omavastuu yrityksen asetuksista (ei kovakoodattu).
 * Sanamuoto yhdessä paikassa (Easoft-tarjous 10244).
 */
export function ktvRateSentence(settings: Pick<KtvSettings, 'ratePercent' | 'capEur' | 'deductibleEur'>): string {
  return (
    `Vähennystä saa verollisesta työn osuudesta ${formatPercent(settings.ratePercent)}, ` +
    `max ${formatCurrency(settings.capEur)} / henkilö; ` +
    `omavastuu ${formatCurrency(settings.deductibleEur)} vuosittain.`
  );
}

const row = (label: string, value: string, className = '') =>
  `<tr${className ? ` class="${className}"` : ''}><td>${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`;

/**
 * Kotitalousvähennyssivu (suunnitelma §1.6). Viimeinen sivu, oma sivunvaihto.
 * Vain yksityisasiakas ilman käänteistä ALV:ta (ctx.ktv puuttuu muille → tyhjä merkkijono).
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
  const many = result.persons > 1;
  const deductible = result.persons * s.deductibleEur;
  const cap = result.persons * s.capEur;
  const customNote = ktv.footnoteText.trim();
  const note = customNote || ktvDefaultNote(result.persons);
  const rows = [
    row('Loppusumma (sis. ALV)', formatCurrency(ktv.totalPriceVat)),
    row('Työn osuus (sis. ALV)', formatCurrency(result.workShareVatIncluded)),
    row(`Kotitalousvähennys (${formatPercent(s.ratePercent)})`, formatCurrency(result.grossDeduction)),
    row(
      many ? `Omavastuu yhteensä (${result.persons} henkilöä)` : 'Omavastuu / henkilö / vuosi',
      `−${formatCurrency(deductible)}`,
    ),
    ...(many || result.capApplied
      ? [
          row(
            many ? `Enimmäismäärä yhteensä (${result.persons} henkilöä)` : 'Enimmäismäärä / henkilö / vuosi',
            formatCurrency(cap),
          ),
        ]
      : []),
    row(
      many ? `Arvioitu kotitalousvähennys (${result.persons} henkilöä)` : 'Arvioitu kotitalousvähennys (1 henkilö)',
      formatCurrency(result.deductionAmount),
      'emphasis',
    ),
    row('Materiaalit (sis. ALV), eivät ole vähennyskelpoisia', formatCurrency(result.materialsShareVatIncluded)),
    row('Arvioitu kustannus vähennyksen jälkeen', formatCurrency(result.estimatedCostAfterDeduction), 'emphasis'),
  ].join('');
  return `<section class="ktv-page page-break">
<h2 class="ktv-title">Kotitalousvähennys</h2>
<p class="ktv-rate-sentence">${escapeHtml(ktvRateSentence(s))}</p>
<div class="price-block"><div class="col"><table>${rows}</table></div></div>
<p class="ktv-one-person">${escapeHtml(ktvPersonsLine(result.persons))}</p>
<p class="ktv-note">${escapeMultiline(note)}</p>
</section>`;
}
