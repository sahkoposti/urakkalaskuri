import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';

import type { TarjousPdfContext } from './buildPdfContext';
import { escapeHtml, escapeMultiline } from './escapeHtml';
import { KTV_DEFAULT_NOTE, kotitalousDeduction } from './kotitalousDeduction';
import type { KtvSettings } from './types';

/** Kiinteä teksti: tulostuu aina, vaikka huomautus olisi muokattu (Eemil/CTO 29.10.2026). */
export const KTV_ONE_PERSON_LINE = 'Laskelma on arvio yhdelle henkilölle.';

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
  const result = kotitalousDeduction({
    totalPriceVat: ktv.totalPriceVat,
    materialsVat: ktv.materialsVat,
    settings: ktv.settings,
  });
  const s = result.settings;
  const note = ktv.footnoteText.trim() || KTV_DEFAULT_NOTE;
  const rows = [
    row('Loppusumma (sis. ALV)', formatCurrency(ktv.totalPriceVat)),
    row('Työn osuus (sis. ALV)', formatCurrency(result.workShareVatIncluded)),
    row(`Kotitalousvähennys (${formatPercent(s.ratePercent)})`, formatCurrency(result.grossDeduction)),
    row('Omavastuu / henkilö / vuosi', `−${formatCurrency(s.deductibleEur)}`),
    ...(result.capApplied ? [row('Enimmäismäärä / henkilö / vuosi', formatCurrency(s.capEur))] : []),
    row('Arvioitu kotitalousvähennys (1 henkilö)', formatCurrency(result.deductionAmount), 'emphasis'),
    row('Materiaalit (sis. ALV), eivät ole vähennyskelpoisia', formatCurrency(result.materialsShareVatIncluded)),
    row('Arvioitu kustannus vähennyksen jälkeen', formatCurrency(result.estimatedCostAfterDeduction), 'emphasis'),
  ].join('');
  return `<section class="ktv-page page-break">
<h2 class="ktv-title">Kotitalousvähennys</h2>
<p class="ktv-rate-sentence">${escapeHtml(ktvRateSentence(s))}</p>
<div class="price-block"><div class="col"><table>${rows}</table></div></div>
<p class="ktv-one-person">${escapeHtml(KTV_ONE_PERSON_LINE)}</p>
<p class="ktv-note">${escapeMultiline(note)}</p>
</section>`;
}
