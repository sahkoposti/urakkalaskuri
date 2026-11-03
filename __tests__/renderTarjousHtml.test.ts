import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { escapeHtml, escapeMultiline } from '../src/core/pdf/escapeHtml';
import { pageNumberContent, PDF_DEFAULT_ACCENT } from '../src/core/pdf/pdfStyles';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
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
    expect(html).toContain('Veroton');
    expect(html).toContain('Loppusumma');
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
  it('shows the inclusive discount between Hinta (sis. alv) and Loppusumma', () => {
    const ctx = buildPdfContext(
      input(record({}, {
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
    const iHinta = totals.indexOf('Hinta (sis. alv)');
    const iAle = totals.indexOf('Alennus 10 %');
    const iLoppu = totals.indexOf('Loppusumma');
    expect(iHinta).toBeGreaterThan(-1);
    expect(iAle).toBeGreaterThan(iHinta);
    expect(iLoppu).toBeGreaterThan(iAle);
    expect(totals).not.toContain('Veroton');
    expect(totals).not.toContain('ALV 25,5 %');
    expect(totals).toContain('−251,00 €');
    expect(totals).toContain('2 259,00 €');
    expect(html).not.toContain('class="offer-vat"');
    const ktv = html.slice(html.indexOf('class="ktv-page'));
    expect(ktv).toContain('2 259,00 €');
    expect(ktv).toContain('502,00 €');
    expect(ktv).toContain('1 757,00 €');
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
    expect(html).toContain('>Veroton</th>');
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
