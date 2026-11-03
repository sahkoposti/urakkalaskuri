import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { escapeHtml } from '../src/core/pdf/escapeHtml';
import { KTV_DEFAULT_NOTE } from '../src/core/pdf/kotitalousDeduction';
import { calculationWithKtvPersons } from '../src/core/pdf/ktvPersons';
import { KTV_ONE_PERSON_LINE, ktvDefaultNote, ktvPersonsLine, ktvRateSentence, renderKotitalousPageHtml } from '../src/core/pdf/renderKotitalousPageHtml';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { input, record } from './pdfFixtures';

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('renderKotitalousPageHtml', () => {
  it('private customer: KTV page is last, with page break and one-person estimate text', () => {
    const ctx = buildPdfContext(input(record({})));
    const html = renderTarjousHtml(ctx);
    const ktvAt = html.indexOf('<section class="ktv-page page-break">');
    expect(ktvAt).toBeGreaterThan(html.indexOf('class="price-block offer-totals"'));
    expect(ktvAt).toBeGreaterThan(html.indexOf('class="offer-sign"'));
    expect(html.slice(ktvAt)).not.toContain('offer-section');
    expect(html).toContain(KTV_ONE_PERSON_LINE);
    expect(html).toContain('arvio yhdelle henkilölle');
    expect(renderKotitalousPageHtml(ctx)).toMatchSnapshot();
  });

  it('business and reverse VAT customers: no KTV page', () => {
    for (const customer of [{ customerType: 'business' as const }, { customerType: 'business' as const, reverseVat: true }]) {
      const html = renderTarjousHtml(buildPdfContext(input(record(customer)))).replace(/<style>[\s\S]*?<\/style>/, '');
      expect(html).not.toContain('ktv-page');
      expect(html).not.toContain('ktv-rate-sentence');
      expect(html).not.toContain('Kotitalousvähennys');
      expect(html).not.toContain('Vähennystä saa');
    }
  });

  it('amounts: (2510 - 502) * 40 % = 803.20 - 150 = 653.20; cost after = 1856.80', () => {
    const html = norm(renderKotitalousPageHtml(buildPdfContext(input(record({})))));
    const loppu = html.indexOf('Loppusumma (sis. ALV)');
    const tyo = html.indexOf('Työn osuus');
    expect(loppu).toBeGreaterThan(-1);
    expect(loppu).toBeLessThan(tyo);
    expect(html).toContain('2 510,00 €');
    expect(html).toContain('Vähennystä saa arvonlisäverollisesta työn osuudesta 40 %, max 2 100,00 € / henkilö vuodessa; omavastuu 150,00 € / henkilö vuodessa.');
    expect(html).toContain('2 008,00 €');
    expect(html).toContain('Kotitalousvähennys (40 %)');
    expect(html).toContain('803,20 €');
    expect(html).toContain('−150,00 €');
    expect(html).toContain('653,20 €');
    expect(html).toContain('1 856,80 €');
    expect(html).not.toContain('Enimmäismäärä');
    expect(html).toContain(KTV_ONE_PERSON_LINE);
    expect(html).toContain(KTV_DEFAULT_NOTE);
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
    expect(html).toContain('Vähennystä saa arvonlisäverollisesta työn osuudesta 50 %, max 500,00 € / henkilö vuodessa; omavastuu 100,00 € / henkilö vuodessa.');
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

  it('discount: Loppusumma is the discounted total and materials are not reduced', () => {
    const html = norm(
      renderKotitalousPageHtml(
        buildPdfContext(
          input(
            record(
              {},
              {
                discountPercent: 10,
                totalPriceVat0BeforeDiscount: 2000,
                totalPriceVatBeforeDiscount: 2510,
                totalPriceVat0: 1800,
                vatAmount: 459,
                totalPriceVat: 2259,
              },
            ),
          ),
        ),
      ),
    );
    const loppu = html.indexOf('Loppusumma (sis. ALV)');
    const tyo = html.indexOf('Työn osuus');
    expect(loppu).toBeGreaterThan(-1);
    expect(loppu).toBeLessThan(tyo);
    expect(html).toContain('2 259,00 €');
    expect(html).not.toContain('2 510,00 €');
    expect(html).toContain('Materiaalit (sis. ALV), eivät ole vähennyskelpoisia');
    expect(html).toContain('502,00 €');
  });

  it('n=2 and n=3 change the person rows and the default estimate wording', () => {
    const two = norm(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(record({}), 2)))));
    expect(two).toContain('Omavastuu yhteensä (2 henkilöä)');
    expect(two).toContain('−300,00 €');
    expect(two).toContain('Enimmäismäärä yhteensä (2 henkilöä)');
    expect(two).toContain('4 200,00 €');
    expect(two).toContain('Arvioitu kotitalousvähennys (2 henkilöä)');
    expect(two).toContain('503,20 €');
    expect(two).not.toContain(ktvPersonsLine(2));
    expect(two).not.toContain('class="ktv-one-person"');
    expect(two).toContain(ktvDefaultNote(2));
    expect(two).not.toContain('yhdelle henkilölle');
    expect(two).not.toContain(KTV_ONE_PERSON_LINE);

    const three = norm(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(record({}), 3)))));
    expect(three).toContain('Omavastuu yhteensä (3 henkilöä)');
    expect(three).toContain('−450,00 €');
    expect(three).toContain('Enimmäismäärä yhteensä (3 henkilöä)');
    expect(three).toContain('6 300,00 €');
    expect(three).toContain('Arvioitu kotitalousvähennys (3 henkilöä)');
    expect(three).not.toContain(ktvPersonsLine(3));
    expect(three).toContain(ktvDefaultNote(3));
    expect(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(record({}), 2))))).toMatchSnapshot();
    expect(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(record({}), 3))))).toMatchSnapshot();
  });

  it('keeps a company note as written when n is greater than 1', () => {
    const ctx = buildPdfContext(
      input(calculationWithKtvPersons(record({}), 2), {
        offerCompany: {
          ...defaultOfferCompanySettings,
          ktvFootnoteText: 'Oma huomautus yhdelle henkilölle.',
        },
      }),
    );
    const html = renderKotitalousPageHtml(ctx);
    expect(html).toContain('Oma huomautus yhdelle henkilölle.');
    expect(html).not.toContain(KTV_DEFAULT_NOTE);
    expect(html).not.toContain('Laskelma on arvio 2 henkilölle.');
    expect(html).not.toContain('class="ktv-one-person"');
  });

  it('escapes the rate sentence', () => {
    const sentence = ktvRateSentence(defaultOfferCompanySettings.ktv);
    const html = renderKotitalousPageHtml(buildPdfContext(input(record({}))));
    const match = html.match(/<p class="ktv-rate-sentence">([\s\S]*?)<\/p>/);
    expect(match?.[1]).toBe(escapeHtml(sentence));
    expect(match?.[1]).not.toContain('<');
  });
});
