import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { escapeHtml, escapeMultiline } from '../src/core/pdf/escapeHtml';
import { pageNumberContent, PDF_BODY_FONT_PT, PDF_DEFAULT_ACCENT, pdfStyles } from '../src/core/pdf/pdfStyles';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { OFFER_ACCEPTANCE_SENTENCE, OFFER_DOC_TITLE, renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { input, line, record } from './pdfFixtures';

const LOGO = 'data:image/png;base64,AAAA';

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(10285)).toBe('10285');
  });

  it('multiline keeps line breaks safely', () => {
    expect(escapeMultiline('a<x>\r\nb\nc')).toBe('a&lt;x&gt;<br />b<br />c');
  });
});

describe('pdf font size', () => {
  it('uses a 12pt body, one point above the previous 11pt', () => {
    expect(PDF_BODY_FONT_PT).toBe(12);
    expect(pdfStyles()).toContain(`font-size: ${PDF_BODY_FONT_PT}pt`);
    expect(pdfStyles()).not.toContain('font-size: 11pt; line-height');
  });
});

describe('offer title and acceptance sentence', () => {
  it('puts Tarjous / sopimus above the offer and the sentence inside the signature block only', () => {
    const html = renderTarjousHtml(
      buildPdfContext(input(record({}, { deliveryScheduleText: 'Viikolla 40' }))),
    );
    const titleAt = html.indexOf('class="offer-doc-title"');
    const signAt = html.indexOf('class="offer-sign"');
    const ktvAt = html.indexOf('class="ktv-page');
    expect(html).toContain(`>${OFFER_DOC_TITLE}<`);
    expect((html.match(/Tarjous \/ sopimus/g) ?? []).length).toBe(1);
    expect(titleAt).toBeGreaterThan(html.indexOf('class="header"'));
    expect(titleAt).toBeLessThan(html.indexOf('class="doc-section offer-section"'));
    expect(titleAt).toBeLessThan(html.indexOf('Toimitusajankohta'));
    const sign = html.slice(signAt, ktvAt);
    expect(sign.indexOf(OFFER_ACCEPTANCE_SENTENCE)).toBeGreaterThan(-1);
    expect(sign.indexOf(OFFER_ACCEPTANCE_SENTENCE)).toBeLessThan(sign.indexOf('offer-sign-role'));
    expect(sign.indexOf(OFFER_ACCEPTANCE_SENTENCE)).toBeLessThan(sign.indexOf('offer-sign-name'));
    expect(html).toContain('.offer-sign-accept { grid-column: 1 / -1;');
    expect(html).toContain('.offer-sign { display: grid;');
    expect(html).toContain('break-inside: avoid');
    const ktv = html.slice(ktvAt);
    expect(ktv).not.toContain(OFFER_DOC_TITLE);
    expect(ktv).not.toContain(OFFER_ACCEPTANCE_SENTENCE);
    const card = renderUrakkakorttiHtml(buildUrakkakorttiContext(input(record({}))));
    expect(card).not.toContain(OFFER_DOC_TITLE);
    expect(card).not.toContain(OFFER_ACCEPTANCE_SENTENCE);
    expect(card).not.toContain('offer-doc-title');
    expect(card).not.toContain('offer-sign-accept');
  });
});

describe('renderTarjousHtml', () => {
  it('private customer: rows table and one section per structure', () => {
    const ctx = buildPdfContext(
      input(record({}, { structureLines: [line('l1', 's1', 'Ulkomaalaus'), line('l2', 's2', 'Sokkeli', '30')] }), {
        offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: 'Maksuehto kuvitteellinen.' },
      }),
    );
    const html = renderTarjousHtml(ctx, { logoDataUri: LOGO });
    expect(html).not.toContain('class="offer-rows"');
    expect(html).toContain('class="offer-line-heading"');
    expect((html.match(/class="doc-section offer-section"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('class="spec-grid"');
    expect(html).not.toContain('class="spec-card');
    expect(html).toContain('Yhteensä alv 0');
    expect(html).toContain('Yhteensä sis. alv');
    expect(html).toContain('1. Tarjouksen hinta');
    expect(html).toContain('Lisätiedot:');
    expect(html).toContain('Maksuehto kuvitteellinen.');
    expect(html).toContain('Sisältää telineet.');
    expect(html).toContain('Toinen teksti');
    expect(html).toContain('"Sivu " counter(page) "/" counter(pages)');
    expect(html).toMatchSnapshot();
  });

  it('business customer: only alv0, no reverse VAT text, no margin/commission', () => {
    const ctx = buildPdfContext(input(record({ customerType: 'business', reverseVat: true })));
    const html = renderTarjousHtml(ctx, { logoDataUri: LOGO });
    expect(html).toContain('Alv 0 %');
    expect(html).not.toContain('class="offer-rows"');
    const content = html.replace(/<style>[\s\S]*?<\/style>/, '');
    expect(content).not.toContain('spec-card');
    expect(content).not.toContain('Käänteinen ALV');
    expect(content).not.toMatch(/Hinta alv<|ALV \d{2}|Kate|Palkkio|margin|commission/i);
    expect(content).not.toMatch(/333,33|77,77/);
    expect(content).not.toContain('25,5');
    expect(html).toMatchSnapshot();
  });

  it('empty company Lisätiedot is omitted; offer page switches do not remove the section', () => {
    const ctx = buildPdfContext(
      input(record({}), {
        offerStructureSettings: { s1: { additionalInfoText: '  ', offerPages: [{ pageId: 'page_surfaces', enabled: false }] } },
      }),
    );
    const html = renderTarjousHtml(ctx);
    expect(html).not.toContain('class="offer-rows"');
    expect(html).toContain('class="doc-section offer-section"');
    expect(html).not.toContain('class="spec-grid"');
    expect(html).not.toContain('Lisätiedot:');
    expect(html).not.toContain('<img');
    expect(html).toMatchSnapshot();
  });

  it('escapes user text everywhere (customer, structure text, labels)', () => {
    const rec = record({ address: '<script>alert(1)</script>' }, { projectName: 'A & <B>' });
    const ctx = buildPdfContext(
      input(rec, { offerStructureSettings: { s1: { additionalInfoText: 'x <img src=x onerror=1>', offerPages: [] } } }),
    );
    const html = renderTarjousHtml(ctx);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('x &lt;img src=x onerror=1&gt;');
    expect(html).toContain('A &amp; &lt;B&gt;');
  });

  it('two-pass fallback uses known total pages', () => {
    expect(pageNumberContent(3)).toBe('"Sivu " counter(page) "/3"');
    expect(pageNumberContent(0)).toContain('counter(pages)');
    const html = renderTarjousHtml(buildPdfContext(input(record({}))), { knownTotalPages: 2 });
    expect(html).toContain('"Sivu " counter(page) "/2"');
  });
});

describe('renderTarjousHtml discount row', () => {
  it('shows Rivit yhteensä, Alennus yhteensä and Alennettu hinta, then the included VAT', () => {
    const ctx = buildPdfContext(
      input(record({}, {
        structureLines: [{ ...line('l1', 's1', 'Ulkomaalaus'), quantity: 1, unitPriceVat0: 2000, discountPercent: 0, vatPercent: 25.5 }],
        discountPercent: 10,
        totalPriceVat0BeforeDiscount: 2000,
        totalPriceVatBeforeDiscount: 2510,
        totalPriceVat0: 1800,
        vatAmount: 459,
        totalPriceVat: 2259,
      })),
    );
    const html = renderTarjousHtml(ctx).replace(/\s+/g, ' ');
    const totals = html.slice(html.indexOf('class="price-block offer-totals"'), html.indexOf('class="offer-sign"'));
    const iRivit = totals.indexOf('Rivit yhteensä');
    const iAle = totals.indexOf('Alennus yhteensä 10 %');
    const iLoppu = totals.indexOf('Alennettu hinta yhteensä');
    const iVat = totals.indexOf('Sisältää ALV 25,5 %');
    expect(iRivit).toBeGreaterThan(-1);
    expect(iAle).toBeGreaterThan(iRivit);
    expect(iLoppu).toBeGreaterThan(iAle);
    expect(iVat).toBeGreaterThan(iLoppu);
    expect(totals).toContain('class="emphasis"');
    expect(totals).not.toContain('Veroton');
    expect(totals).toContain('−251,00 €');
    expect(totals).toContain('2 259,00 €');
    expect(totals).toContain('459,00 €');
    expect(html).not.toContain('class="offer-vat"');
    const ktv = html.slice(html.indexOf('class="ktv-page'));
    expect(ktv).toContain('Alennettu hinta yhteensä');
    expect(ktv).toContain('2 259,00 €');
    expect(ktv).toContain('451,80 €');
    expect(ktv).toContain('1 807,20 €');
    expect(ktv).toContain('Arvioitu hinta vähennyksen jälkeen');
    expect(ktv).toContain('2 259,00 € − 572,88 €');
    expect(ktv).toContain('1 686,12 €');
    expect(ktv).not.toContain('Asiakkaan maksettavaksi');
    expect(ktv).not.toContain('Enimmäismäärä');
  });

  it('keeps the VAT table only when more than one rate is present', () => {
    const single = renderTarjousHtml(buildPdfContext(input(record({}))));
    expect(single).not.toContain('class="offer-vat"');
    const mixed = record({}, {
      structureLines: [
        { ...line('a', 's1', 'A'), vatPercent: 25.5 },
        { ...line('b', 's2', 'B'), vatPercent: 10 },
      ],
    });
    const html = renderTarjousHtml(buildPdfContext(input(mixed)));
    expect(html).toContain('class="offer-vat"');
    expect(html).toContain('>Netto</th>');
    expect(html.indexOf('class="offer-vat"')).toBeLessThan(html.indexOf('Yhteensä alv 0'));
    expect(html.indexOf('Yhteensä sis. alv')).toBeLessThan(html.indexOf('class="offer-sign"'));
  });

  it('draws the brand bar on the offer only, using the same accent as Loppusumma', () => {
    const html = renderTarjousHtml(buildPdfContext(input(record({}))));
    expect(html).toContain('@left-middle { content: ""; background: ' + PDF_DEFAULT_ACCENT);
    expect(html).toContain('margin: 10mm 18mm 12mm 2.5mm');
    expect(html).toContain('padding-left: 15.5mm');
    expect(html).toContain('"Sivu " counter(page) "/" counter(pages)');
    const themed = renderTarjousHtml(buildPdfContext(input(record({}))), { accentColor: '#123abc' });
    expect(themed).toContain('background: #123abc');
    expect(themed).not.toContain(`background: ${PDF_DEFAULT_ACCENT}`);
    const card = renderUrakkakorttiHtml(buildUrakkakorttiContext(input(record({}))));
    expect(card).not.toContain('@left-middle');
    expect(card).toContain('margin: 10mm 14mm 12mm 14mm');
  });
});
