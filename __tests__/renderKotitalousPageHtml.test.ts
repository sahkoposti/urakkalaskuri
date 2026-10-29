import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { KHV_DEFAULT_NOTE } from '../src/core/pdf/kotitalousDeduction';
import { KHV_ONE_PERSON_LINE, renderKotitalousPageHtml } from '../src/core/pdf/renderKotitalousPageHtml';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { input, record } from './pdfFixtures';

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('renderKotitalousPageHtml', () => {
  it('private customer: KHV page is last, with page break and one-person estimate text', () => {
    const html = renderTarjousHtml(buildPdfContext(input(record({}))));
    const khvAt = html.indexOf('<section class="khv-page page-break">');
    expect(khvAt).toBeGreaterThan(html.indexOf('class="price-block"'));
    expect(khvAt).toBeGreaterThan(html.indexOf('Lisätiedot:'));
    expect(html.slice(khvAt)).not.toContain('spec-card');
    expect(html).toContain(KHV_ONE_PERSON_LINE);
    expect(html).toContain('arvio yhdelle henkilölle');
    expect(html).toMatchSnapshot();
  });

  it('business and reverse VAT customers: no KHV page', () => {
    for (const customer of [{ customerType: 'business' as const }, { customerType: 'business' as const, reverseVat: true }]) {
      const html = renderTarjousHtml(buildPdfContext(input(record(customer)))).replace(/<style>[\s\S]*?<\/style>/, '');
      expect(html).not.toContain('khv-page');
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
          khv: { ratePercent: 50, deductibleEur: 100, capEur: 500 },
          khvFootnoteText: 'Oma <huomautus>',
        },
      }),
    );
    const html = norm(renderKotitalousPageHtml(ctx));
    expect(html).toContain('Kotitalousvähennys (50 %)');
    expect(html).toContain('−100,00 €');
    expect(html).toContain('Enimmäismäärä / henkilö / vuosi');
    expect(html).toContain('500,00 €');
    expect(html).toContain('Oma &lt;huomautus&gt;');
    expect(html).not.toContain(KHV_DEFAULT_NOTE);
    expect(html).toContain(KHV_ONE_PERSON_LINE);
  });

  it('default note when settings text is empty', () => {
    expect(renderKotitalousPageHtml(buildPdfContext(input(record({}))))).toContain(KHV_DEFAULT_NOTE);
    expect(renderKotitalousPageHtml({ khv: undefined })).toBe('');
  });
});
