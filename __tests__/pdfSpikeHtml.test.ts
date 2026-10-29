import { buildPdfSpikeHtml, escapeHtmlText } from '../src/core/pdf/pdfSpikeHtml';

describe('buildPdfSpikeHtml', () => {
  it('renders 3 pages with page breaks, fixed header/footer and page counter', () => {
    const html = buildPdfSpikeHtml({ logoDataUri: 'data:image/png;base64,AAAA' });
    expect(html.match(/<section class="test-page/g)).toHaveLength(3);
    expect(html.match(/class="test-page break"/g)).toHaveLength(2);
    expect(html).toContain('counter(pages)');
    expect(html).toContain('@bottom-right');
    expect(html).toContain('position: fixed');
    expect(html).toContain('<thead><tr><td class="spacer-top">');
    expect(html).toContain('<img class="logo" src="data:image/png;base64,AAAA"');
    expect(html).toContain('Ääkköset');
  });

  it('shows a visible marker when logo is missing', () => {
    expect(buildPdfSpikeHtml({ logoDataUri: null })).toContain('LOGO PUUTTUU');
  });

  it('adds static two-pass page numbers when total is known', () => {
    const html = buildPdfSpikeHtml({ knownTotalPages: 3 });
    expect(html).toContain('Sivu 1/3');
    expect(html).toContain('Sivu 3/3');
    expect(buildPdfSpikeHtml()).not.toContain('Kaksivaiheinen arvo');
  });

  it('escapes html', () => {
    expect(escapeHtmlText(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});
