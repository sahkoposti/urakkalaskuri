import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { escapeHtml, escapeMultiline } from '../src/core/pdf/escapeHtml';
import { pageNumberContent } from '../src/core/pdf/pdfStyles';
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
  it('private customer with two cards side by side', () => {
    const ctx = buildPdfContext(
      input(record({}, { structureLines: [line('l1', 's1', 'Ulkomaalaus'), line('l2', 's2', 'Sokkeli', '30')] })),
    );
    const html = renderTarjousHtml(ctx, { logoDataUri: LOGO });
    expect(html).toContain('<div class="spec-grid">');
    expect((html.match(/class="spec-card"/g) ?? []).length).toBe(2);
    expect(html).not.toContain('spec-card full');
    expect(html).toContain('Hinta alv0');
    expect(html).toContain('Loppusumma');
    expect(html).toContain('Lisätiedot:');
    expect(html).toContain('"Sivu " counter(page) "/" counter(pages)');
    expect(html).toMatchSnapshot();
  });

  it('business customer: only alv0, no reverse VAT text, no margin/commission', () => {
    const ctx = buildPdfContext(input(record({ customerType: 'business', reverseVat: true })));
    const html = renderTarjousHtml(ctx, { logoDataUri: LOGO });
    expect(html).toContain('spec-card full');
    const content = html.replace(/<style>[\s\S]*?<\/style>/, '');
    expect(content).not.toMatch(/Hinta alv<|ALV \d|Käänteinen|Kate|Palkkio|margin|commission/i);
    expect(content).not.toMatch(/333,33|77,77/);
    expect(html).toMatchSnapshot();
  });

  it('0 cards: prices directly under the header, Lisätiedot omitted when empty', () => {
    const ctx = buildPdfContext(
      input(record({}), {
        offerStructureSettings: { s1: { additionalInfoText: '  ', offerPages: [{ pageId: 'page_surfaces', enabled: false }] } },
      }),
    );
    const html = renderTarjousHtml(ctx);
    expect(html).not.toContain('<div class="spec-grid">');
    expect(html).toMatch(/<tbody><tr><td>\n<div class="price-block">/);
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
  it('shows the discount as its own row between Hinta alv and Loppusumma', () => {
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
    const iHinta = html.indexOf('Hinta alv<');
    const iAle = html.indexOf('Alennus 10 %');
    const iLoppu = html.indexOf('Loppusumma');
    expect(iHinta).toBeGreaterThan(-1);
    expect(iAle).toBeGreaterThan(iHinta);
    expect(iLoppu).toBeGreaterThan(iAle);
    expect(html).toMatch(/−251,00 €/);
  });
});
