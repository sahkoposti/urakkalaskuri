import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { KTV_DEFAULT_NOTE } from '../src/core/pdf/kotitalousDeduction';
import { KTV_ONE_PERSON_LINE, renderKotitalousPageHtml } from '../src/core/pdf/renderKotitalousPageHtml';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { input, record } from './pdfFixtures';

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('renderKotitalousPageHtml', () => {
  it('private customer: KTV page is last, with page break and one-person estimate text', () => {
    const ctx = buildPdfContext(input(record({})));
    const html = renderTarjousHtml(ctx);
    const ktvAt = html.indexOf('<section class="ktv-page page-break">');
    expect(ktvAt).toBeGreaterThan(html.indexOf('class="price-block"'));
    expect(ktvAt).toBeGreaterThan(html.indexOf('class="offer-seller"'));
    expect(html.slice(ktvAt)).not.toContain('offer-section');
    expect(html).toContain(KTV_ONE_PERSON_LINE);
    expect(html).toContain('arvio yhdelle henkilölle');
    expect(renderKotitalousPageHtml(ctx)).toMatchSnapshot();
  });

  it('business and reverse VAT customers: no KTV page', () => {
    for (const customer of [{ customerType: 'business' as const }, { customerType: 'business' as const, reverseVat: true }]) {
      const html = renderTarjousHtml(buildPdfContext(input(record(customer)))).replace(/<style>[\s\S]*?<\/style>/, '');
      expect(html).not.toContain('ktv-page');
      expect(html).not.toContain('Kotitalousvähennys');
    }
  });

  it('amounts: (2510 - 502) * 40 % = 803.20 - 150 = 653.20; cost after = 1856.80', () => {
    const html = norm(renderKotitalousPageHtml(buildPdfContext(input(record({})))));
    expect(html).toContain('2 008,00 €');
    expect(html).toContain('Kotitalousvähennys (40 %)');
    expect(html).toContain('803,20 €');
    expect(html).toContain('−150,00 €');
    expect(html).toContain('653,20 €');
    expect(html).toContain('1 856,80 €');
    expect(html).not.toContain('Enimmäismäärä');
  });

  it('uses company settings (rate, deductible, cap) and shows the cap when applied', () => {
    const ctx = buildPdfContext(
      input(record({}), {
        offerCompany: {
          ...defaultOfferCompanySettings,
          ktv: { ratePercent: 50, deductibleEur: 100, capEur: 500 },
          ktvFootnoteText: 'Oma <huomautus>',
        },
      }),
    );
    const html = norm(renderKotitalousPageHtml(ctx));
    expect(html).toContain('Kotitalousvähennys (50 %)');
    expect(html).toContain('−100,00 €');
    expect(html).toContain('Enimmäismäärä / henkilö / vuosi');
    expect(html).toContain('500,00 €');
    expect(html).toContain('Oma &lt;huomautus&gt;');
    expect(html).not.toContain(KTV_DEFAULT_NOTE);
    expect(html).toContain(KTV_ONE_PERSON_LINE);
  });

  it('default note when settings text is empty', () => {
    expect(renderKotitalousPageHtml(buildPdfContext(input(record({}))))).toContain(KTV_DEFAULT_NOTE);
    expect(renderKotitalousPageHtml({ ktv: undefined })).toBe('');
  });
});
