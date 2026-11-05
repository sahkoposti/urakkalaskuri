import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { escapeHtml } from '../src/core/pdf/escapeHtml';
import { KTV_DEFAULT_NOTE } from '../src/core/pdf/kotitalousDeduction';
import { calculationWithKtvPersons } from '../src/core/pdf/ktvPersons';
import { ktvDefaultNote, ktvPersonsUsedHint, ktvRateSentence, renderKotitalousPageHtml } from '../src/core/pdf/renderKotitalousPageHtml';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { input, line, record } from './pdfFixtures';

/** Rivin brutto täsmää tallennettuun 2 510:een, jotta KTV-kaava pysyy samana. */
function recordAt2510() {
  return record({}, { structureLines: [{ ...line('l1', 's1', 'Ulkomaalaus'), unitPriceVat0: 2000 }] });
}

const norm = (s: string) => s.replace(/\s/g, ' ');

describe('renderKotitalousPageHtml', () => {
  it('private customer: KTV page is last, with page break and the default note', () => {
    const ctx = buildPdfContext(input(recordAt2510()));
    const html = renderTarjousHtml(ctx);
    const ktvAt = html.indexOf('<section class="ktv-page page-break">');
    expect(ktvAt).toBeGreaterThan(html.indexOf('class="price-block offer-totals"'));
    expect(ktvAt).toBeGreaterThan(html.indexOf('class="offer-sign"'));
    expect(html.slice(ktvAt)).not.toContain('offer-section');
    expect(html).not.toContain('Laskelma on arvio');
    expect(html).not.toContain('class="ktv-one-person"');
    expect(html).toContain('Kotitalousvähennyslaskelma (1 hlö)');
    expect(html).toContain(KTV_DEFAULT_NOTE);
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

  it('amounts: (2510 - 502) * 40 % = 803.20 - 150 = 653.20, without a cap row or a payable block', () => {
    const html = norm(renderKotitalousPageHtml(buildPdfContext(input(recordAt2510()))));
    const loppu = html.indexOf('Yhteensä sis. alv');
    const tyo = html.indexOf('josta työn osuus (sis. alv)');
    expect(loppu).toBeGreaterThan(-1);
    expect(loppu).toBeLessThan(tyo);
    expect(html).toContain('2 510,00 €');
    expect(html).toContain('Vähennystä saa arvonlisäverollisesta työn osuudesta 40 %, max 2 100,00 € / henkilö vuodessa; omavastuu 150,00 € / henkilö vuodessa.');
    expect(html).toContain('2 008,00 €');
    expect(html).toContain('Kotitalousvähennys 40 % työn osuudesta');
    expect(html).toContain('803,20 €');
    expect(html).toContain('−150,00 €');
    expect(html).toContain('653,20 €');
    expect(html).not.toContain('Enimmäismäärä');
    expect(html).not.toContain('Asiakkaan maksettavaksi');
    expect(html).not.toContain('Arvioitu hinta vähennyksen jälkeen');
    expect(html).not.toContain('1 856,80 €');
    expect(html).not.toContain('class="ktv-hint"');
    expect(html).not.toContain('Laskelma on arvio');
    expect(html).toContain(KTV_DEFAULT_NOTE);
  });

  it('uses company settings (rate, deductible, cap) and shows the cap when applied', () => {
    const ctx = buildPdfContext(
      input(recordAt2510(), {
        offerCompany: {
          ...defaultOfferCompanySettings,
          ktv: { ratePercent: 50, deductibleEur: 100, capEur: 500 },
          ktvFootnoteText: 'Oma <huomautus>',
        },
      }),
    );
    const html = norm(renderKotitalousPageHtml(ctx));
    expect(html).toContain('Kotitalousvähennys 50 % työn osuudesta');
    expect(html).toContain('Vähennystä saa arvonlisäverollisesta työn osuudesta 50 %, max 500,00 € / henkilö vuodessa; omavastuu 100,00 € / henkilö vuodessa.');
    expect(html).toContain('500,00 €');
    expect(html).toContain('100,00 €');
    expect(html).not.toContain('2 100,00 €');
    expect(html).not.toContain('150,00 €');
    expect(html).toContain('−100,00 €');
    expect(html).not.toContain('Enimmäismäärä');
    expect(html).toContain('max 500,00 € / henkilö vuodessa');
    expect(html).toContain('Oma &lt;huomautus&gt;');
    expect(html).not.toContain(KTV_DEFAULT_NOTE);
    expect(html).not.toContain('Laskelma on arvio');
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
    const loppu = html.indexOf('Alennettu hinta yhteensä');
    const tyo = html.indexOf('josta työn osuus (sis. alv)');
    expect(loppu).toBeGreaterThan(-1);
    expect(loppu).toBeLessThan(tyo);
    expect(html).toContain('2 259,00 €');
    expect(html).not.toContain('2 510,00 €');
    expect(html).not.toContain('Yhteensä sis. alv');
    expect(html).toContain('josta materiaalit (sis. alv)');
    expect(html).toContain('502,00 €');
    expect(html).toContain('Alennettu hinta yhteensä');
    expect(html).not.toContain('Asiakkaan maksettavaksi');
  });

  it('n=2 and n=3 change the person rows and the default estimate wording', () => {
    const two = norm(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(recordAt2510(), 2)))));
    expect(two).toContain('Kotitalousvähennyslaskelma (2 hlö)');
    expect(two).not.toContain('Kotitalousvähennyslaskelma (1 hlö)');
    expect(two).toContain('Omavastuu (1 hlö)');
    expect(two).toContain('−150,00 €');
    expect(two).toContain('Arvioitu kotitalousvähennys (1 hlö)');
    expect(two).toContain('653,20 €');
    expect(two).toContain(ktvPersonsUsedHint(1, 2));
    expect(two).not.toContain('Enimmäismäärä');
    expect(two).not.toContain('Asiakkaan maksettavaksi');
    expect(two).not.toContain('−300,00 €');
    expect(two).not.toContain('Henkilöittäin');
    expect(two).not.toContain('tasajako');
    expect(two).not.toContain('Arvioitu vähennys / henkilö');
    expect(two).toContain('max 2 100,00 € / henkilö vuodessa');
    expect(two).not.toContain('class="ktv-one-person"');
    expect(two).toContain(ktvDefaultNote(2));
    expect(two).not.toContain('yhdelle henkilölle');
    expect(two).not.toContain('Laskelma on arvio');

    const three = norm(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(recordAt2510(), 3)))));
    expect(three).toContain('Kotitalousvähennyslaskelma (3 hlö)');
    expect(three).toContain('Omavastuu (1 hlö)');
    expect(three).toContain(ktvPersonsUsedHint(1, 3));
    expect(three).not.toContain('Omavastuu (3 hlö)');
    expect(three).not.toContain('Enimmäismäärä');
    expect(three).not.toContain('tasajako');
    expect(three).toContain(ktvDefaultNote(3));
    expect(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(recordAt2510(), 2))))).toMatchSnapshot();
    expect(renderKotitalousPageHtml(buildPdfContext(input(calculationWithKtvPersons(recordAt2510(), 3))))).toMatchSnapshot();
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

  it('prints the previous 1-person amounts and uses one person when n=2 does not raise the deduction', () => {
    const page = (persons: number) =>
      norm(
        renderKotitalousPageHtml({
          ktv: {
            totalPriceVat: 1725.62,
            materialsVat: 200.8,
            settings: defaultOfferCompanySettings.ktv,
            footnoteText: '',
            persons,
            totalLabel: 'Yhteensä sis. alv',
          },
        }),
      );
    const one = page(1);
    for (const amount of ['1 725,62 €', '200,80 €', '1 524,82 €', '609,93 €', '−150,00 €', '459,93 €']) {
      expect(one).toContain(amount);
    }
    expect(one.indexOf('1 725,62 €')).toBeLessThan(one.indexOf('200,80 €'));
    expect(one.indexOf('200,80 €')).toBeLessThan(one.indexOf('1 524,82 €'));
    expect(one.indexOf('1 524,82 €')).toBeLessThan(one.indexOf('609,93 €'));
    expect(one.indexOf('609,93 €')).toBeLessThan(one.indexOf('−150,00 €'));
    expect(one.indexOf('−150,00 €')).toBeLessThan(one.indexOf('459,93 €'));
    expect(one).toContain('max 2 100,00 € / henkilö vuodessa');
    expect(one).not.toContain('Enimmäismäärä');
    expect(one).not.toContain('Asiakkaan maksettavaksi');
    expect(one).not.toContain('Arvioitu hinta vähennyksen jälkeen');
    expect(one).not.toContain('1 265,69 €');
    expect(one).not.toContain('class="ktv-hint"');
    expect(one).not.toContain('Henkilöittäin');
    expect(one).not.toContain('Arvioitu vähennys / henkilö');
    expect(one).not.toContain('tasajako');
    expect(one).not.toContain('Laskelma on arvio');

    const two = page(2);
    expect(two).toContain('Kotitalousvähennyslaskelma (2 hlö)');
    expect(two).toContain('Omavastuu (1 hlö)');
    expect(two).toContain('−150,00 €');
    expect(two).toContain('459,93 €');
    expect(two).toContain(ktvPersonsUsedHint(1, 2));
    expect(two).not.toContain('309,93 €');
    expect(two).not.toContain('−300,00 €');
    expect(two).not.toContain('1 415,69 €');
    expect(two).not.toContain('Enimmäismäärä');
    expect(two).not.toContain('Henkilöittäin');
    expect(two).not.toContain('tasajako');
    expect(two).not.toContain('Laskelma on arvio');
  });

  it('shows the plural hint only when more than one person is needed and n is larger', () => {
    const html = (persons: number, totalPriceVat: number) =>
      norm(
        renderKotitalousPageHtml({
          ktv: {
            totalPriceVat,
            materialsVat: 0,
            settings: defaultOfferCompanySettings.ktv,
            footnoteText: '',
            persons,
            totalLabel: 'Yhteensä sis. alv',
          },
        }),
      );
    const twoOfThree = html(3, 7500);
    expect(twoOfThree).toContain('Kotitalousvähennyslaskelma (3 hlö)');
    expect(twoOfThree).toContain('Omavastuu (2 hlö)');
    expect(twoOfThree).toContain(ktvPersonsUsedHint(2, 3));
    expect(twoOfThree).not.toContain(ktvPersonsUsedHint(1, 3));

    const bothNeeded = html(2, 8000);
    expect(bothNeeded).toContain('Omavastuu (2 hlö)');
    expect(bothNeeded).not.toContain('class="ktv-hint"');
  });
});
