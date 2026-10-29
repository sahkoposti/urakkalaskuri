import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';

import type { TarjousPdfContext } from './buildPdfContext';
import { escapeHtml, escapeMultiline } from './escapeHtml';
import { KHV_DEFAULT_NOTE, kotitalousDeduction } from './kotitalousDeduction';

/** Kiinteä teksti: tulostuu aina, vaikka huomautus olisi muokattu (Eemil/CTO 29.10.2026). */
export const KHV_ONE_PERSON_LINE = 'Laskelma on arvio yhdelle henkilölle.';

const row = (label: string, value: string, className = '') =>
  `<tr${className ? ` class="${className}"` : ''}><td>${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`;

/**
 * Kotitalousvähennyssivu (suunnitelma §1.6). Viimeinen sivu, oma sivunvaihto.
 * Vain yksityisasiakas ilman käänteistä ALV:ta (ctx.khv puuttuu muille → tyhjä merkkijono).
 */
export function renderKotitalousPageHtml(ctx: Pick<TarjousPdfContext, 'khv'>): string {
  const khv = ctx.khv;
  if (!khv) return '';
  const result = kotitalousDeduction({
    totalPriceVat: khv.totalPriceVat,
    materialsVat: khv.materialsVat,
    settings: khv.settings,
  });
  const s = result.settings;
  const note = khv.footnoteText.trim() || KHV_DEFAULT_NOTE;
  const rows = [
    row('Työn osuus (sis. ALV)', formatCurrency(result.workShareVatIncluded)),
    row(`Kotitalousvähennys (${formatPercent(s.ratePercent)})`, formatCurrency(result.grossDeduction)),
    row('Omavastuu / henkilö / vuosi', `−${formatCurrency(s.deductibleEur)}`),
    ...(result.capApplied ? [row('Enimmäismäärä / henkilö / vuosi', formatCurrency(s.capEur))] : []),
    row('Arvioitu kotitalousvähennys (1 henkilö)', formatCurrency(result.deductionAmount), 'emphasis'),
    row('Materiaalit', 'eivät ole vähennyskelpoisia'),
    row('Arvioitu kustannus vähennyksen jälkeen', formatCurrency(result.estimatedCostAfterDeduction), 'emphasis'),
  ].join('');
  return `<section class="khv-page page-break">
<h2 class="khv-title">Kotitalousvähennys</h2>
<div class="price-block"><div class="col"><table>${rows}</table></div></div>
<p class="khv-one-person">${escapeHtml(KHV_ONE_PERSON_LINE)}</p>
<p class="khv-note">${escapeMultiline(note)}</p>
</section>`;
}
