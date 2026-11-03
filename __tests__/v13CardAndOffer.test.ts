import type { FormField } from '../src/core/form/types';
import { normalizePrintSettings, resolveTargetPrint, defaultEsitys } from '../src/core/form/printSettings';
import { esitysAfterGroupChange, writePrintEditorState } from '../src/core/form/printEditorState';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import {
  normalizeOfferCompanySettings,
  parseSivukulukerroinInput,
  sivukulukerroinDraftError,
} from '../src/core/pdf/defaultOfferSettings';
import { offerSignatureParties } from '../src/core/pdf/offerDocument';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext, urakkakorttiBodyBlocks } from '../src/core/pdf/urakkakortti';
import {
  calculationWithHuomioitavaa,
  calculationWithUrakkakorttiMode,
  effectiveHuomioitavaa,
  employeeContractAmount,
  preserveCalculationSnapshot,
} from '../src/core/pdf/urakkakorttiCard';
import { formatCurrency, formatPrintedQuantity, stripTrailingZeroDecimals } from '../src/core/utils/formatters';
import { defaultCompanyProfile } from '../src/core/company/defaultCompany';
import { input, line, record, structure } from './pdfFixtures';
import type { FormDefinition } from '../src/core/form/types';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return { label: partial.key, required: false, showOnSummary: false, ...partial };
}

function formOf(fields: FormField[]): FormDefinition {
  return {
    id: 'f',
    name: 'F',
    version: 1,
    updatedAt: 1,
    pages: [{ id: 'p', title: 'Sivu', sortOrder: 0, fieldIds: fields.map((item) => item.id) }],
    fields,
  };
}

const bodyOf = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');

describe('printed integers', () => {
  it('drops only an all-zero fraction and does not add a thousands separator', () => {
    expect(formatPrintedQuantity(14)).toBe('14');
    expect(formatPrintedQuantity(2.5)).toBe('2,5');
    expect(formatPrintedQuantity(100000)).toBe('100000');
    expect(stripTrailingZeroDecimals('120,0 m²')).toBe('120 m²');
    expect(stripTrailingZeroDecimals('14,00 kpl')).toBe('14 kpl');
    expect(stripTrailingZeroDecimals('2,5')).toBe('2,5');
    expect(stripTrailingZeroDecimals('2,50')).toBe('2,50');
    expect(stripTrailingZeroDecimals('1 000,00 €')).toBe('1 000,00 €');
  });
});

describe('print.esititys', () => {
  const area = field({ id: 'a', key: 'alue', type: 'boolean', print: { offer: { group: 'osa_alueet' } } });
  const fact = field({ id: 't', key: 'korkeus', type: 'number', print: { offer: true } });
  const form = formOf([area, fact]);

  it('uses the group default when esitys is absent and keeps an explicit override', () => {
    expect(defaultEsitys('osa_alueet')).toBe('teksti');
    expect(defaultEsitys('tyovaiheet')).toBe('teksti');
    expect(defaultEsitys('muuta')).toBe('teksti');
    expect(defaultEsitys('tieto')).toBe('taulukko');
    expect(defaultEsitys('maali')).toBe('taulukko');
    expect(resolveTargetPrint(area, 'offer', form)?.esitys).toBe('teksti');
    expect(resolveTargetPrint(fact, 'offer', form)?.esitys).toBe('taulukko');
    const overridden = field({
      id: 't',
      key: 'korkeus',
      type: 'number',
      print: { offer: { esitys: 'teksti' } },
    });
    expect(resolveTargetPrint(overridden, 'offer', formOf([overridden]))?.esitys).toBe('teksti');
    const card = field({
      id: 'm',
      key: 'maali',
      type: 'product_select',
      print: { urakkakortti: { group: 'maali', esitys: 'teksti' } },
    });
    expect(resolveTargetPrint(card, 'urakkakortti', formOf([card]))?.esitys).toBe('teksti');
  });

  it('drops an unknown esitys with a Finnish warning and omits the default from saved JSON', () => {
    const item = field({ id: 't', key: 'korkeus', type: 'number' });
    const dropped = normalizePrintSettings({ offer: { esitys: 'ruudukko' } }, item, formOf([item]));
    expect(dropped.print).toEqual({ offer: {} });
    expect(dropped.warnings[0]).toContain('virheellinen print.offer.esitys');
    expect(dropped.warnings[0]).toContain('ohitettu');
    const written = writePrintEditorState(
      {
        legacy: false,
        when: 'notEmpty',
        offer: { group: 'tieto', esitys: 'taulukko' },
        urakkakortti: null,
      },
      item,
      formOf([item]),
    );
    expect(written).toEqual({ offer: true });
    expect(esitysAfterGroupChange('taulukko', 'osa_alueet', 'tyovaiheet')).toBe('taulukko');
    expect(esitysAfterGroupChange('taulukko', 'tieto', 'muuta')).toBeUndefined();
    expect(esitysAfterGroupChange(undefined, 'tieto', 'muuta')).toBeUndefined();
    expect(esitysAfterGroupChange('teksti', 'osa_alueet', 'tyovaiheet')).toBeUndefined();
  });
});

describe('sivukulukerroin', () => {
  it('keeps 3 and 1,25 and replaces 1, 3,01, 0, abc and empty with 1,5', () => {
    expect(parseSivukulukerroinInput('1')).toBe('invalid');
    expect(parseSivukulukerroinInput('3')).toBe(3);
    expect(parseSivukulukerroinInput('3,01')).toBe('invalid');
    expect(parseSivukulukerroinInput('3.01')).toBe('invalid');
    expect(parseSivukulukerroinInput('0')).toBe('invalid');
    expect(parseSivukulukerroinInput('abc')).toBe('invalid');
    expect(parseSivukulukerroinInput('')).toBe('empty');
    expect(parseSivukulukerroinInput('1,25')).toBe(1.25);
    expect(parseSivukulukerroinInput('1.5')).toBe(1.5);
    expect(sivukulukerroinDraftError('1')).toMatch(/suurempi kuin 1/);
    expect(sivukulukerroinDraftError('')).toBeNull();
    expect(sivukulukerroinDraftError('3')).toBeNull();
    for (const value of [1, 3.01, 0, 'abc', '']) {
      expect(normalizeOfferCompanySettings({ sivukulukerroin: value }).sivukulukerroin).toBe(1.5);
    }
    expect(normalizeOfferCompanySettings({ sivukulukerroin: 3 }).sivukulukerroin).toBe(3);
    expect(normalizeOfferCompanySettings({ sivukulukerroin: '1,25' }).sivukulukerroin).toBe(1.25);
  });
});

describe('urakkakortti työntekijä and huomioitavaa', () => {
  it('divides every contract row, rounds to cents and sums the rounded rows', () => {
    expect(employeeContractAmount(3000, 'tyontekija', 1.5)).toBe(2000);
    expect(employeeContractAmount(3000, 'tyontekija', 1.25)).toBe(2400);
    expect(employeeContractAmount(100, 'tyontekija', 1.5)).toBe(66.67);
    expect(employeeContractAmount(10.01, 'tyontekija', 1.25)).toBe(8.01);
    expect(employeeContractAmount(0, 'tyontekija', 1.5)).toBe(0);
    expect(employeeContractAmount(3000, 'alihankkija', 1.5)).toBe(3000);

    const lines = [
      { ...line('a', 's1', 'Ulkomaalaus'), contractPriceVat0: 100 },
      { ...line('b', 's2', 'Sokkeli'), contractPriceVat0: 100 },
      { ...line('c', 's3', 'Nolla'), contractPriceVat0: 0 },
    ];
    const base = record({}, { structureLines: lines });
    const employee = calculationWithUrakkakorttiMode(base, 'tyontekija');
    const ctx = buildUrakkakorttiContext({ ...input(employee), sivukulukerroin: 1.5 });
    expect(ctx.modeLabel).toBe('Urakkakortti: Työntekijä');
    expect(ctx.contractRows.map((row) => row.value)).toEqual([
      formatCurrency(66.67),
      formatCurrency(66.67),
      formatCurrency(0),
      formatCurrency(133.34),
    ]);
    const html = renderUrakkakorttiHtml(ctx);
    const cardBody = bodyOf(html);
    expect(html).not.toMatch(/kerroin/i);
    expect(cardBody).not.toContain('1,5');
    expect(cardBody).not.toContain('1.5');
    expect(html).not.toContain('Työryhmän koko');

    const unchanged = buildUrakkakorttiContext(input(base));
    expect(unchanged.modeLabel).toBe('Urakkakortti: Alihankkija');
    expect(unchanged.contractRows.map((row) => row.value)).toEqual([
      formatCurrency(100),
      formatCurrency(100),
      formatCurrency(0),
      formatCurrency(200),
    ]);
  });

  it('prefills Huomioitavaa from customer notes, keeps an edit, and omits a blank section', () => {
    const source = record({ notes: 'Koira pihalla' });
    expect(source.formSnapshot?.urakkakorttiHuomioitavaa).toBeUndefined();
    const prefilled = buildUrakkakorttiContext(input(source));
    expect(prefilled.huomioitavaa).toBe('Koira pihalla');
    expect(prefilled.customerNotes).toBe('Koira pihalla');
    expect(renderUrakkakorttiHtml(prefilled)).toContain('>Huomioitavaa<');
    expect(renderUrakkakorttiHtml(prefilled)).not.toContain('Asiakkaan lisätiedot');

    const edited = calculationWithHuomioitavaa(source, 'Rivi 1\nRivi <2>');
    const again = { ...source, formSnapshot: edited.formSnapshot };
    expect(effectiveHuomioitavaa(again)).toBe('Rivi 1\nRivi <2>');
    const editedHtml = renderUrakkakorttiHtml(buildUrakkakorttiContext(input(again)));
    expect(editedHtml).toContain('Rivi 1');
    expect(editedHtml).toContain('Rivi &lt;2&gt;');
    expect(editedHtml).not.toContain('Koira pihalla');
    expect((editedHtml.match(/class="doc-line"/g) ?? []).length).toBeGreaterThan(1);

    const cleared = calculationWithHuomioitavaa(source, '   ');
    const clearedHtml = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(input(cleared))));
    expect(clearedHtml).not.toContain('Huomioitavaa');
    expect(clearedHtml).not.toContain('Koira pihalla');

    const offerPlain = renderTarjousHtml(buildPdfContext(input(source)));
    const offerEdited = renderTarjousHtml(buildPdfContext(input(edited)));
    expect(offerEdited).toBe(offerPlain);
    expect(offerEdited).not.toContain('Rivi &lt;2&gt;');
  });

  it('keeps card extras across a wizard rebuild and lists body blocks in order', () => {
    const previous = calculationWithHuomioitavaa(
      calculationWithUrakkakorttiMode(record({ notes: 'Lähde' }), 'tyontekija'),
      'Muokattu',
    );
    const rebuilt = preserveCalculationSnapshot(record({ notes: 'Lähde' }), previous.formSnapshot);
    expect(rebuilt.formSnapshot?.urakkakorttiMode).toBe('tyontekija');
    expect(rebuilt.formSnapshot?.urakkakorttiHuomioitavaa).toBe('Muokattu');
    const blocks = urakkakorttiBodyBlocks(buildUrakkakorttiContext(input(record({ notes: 'Lähde' }))));
    expect(blocks[0]).toBe('price');
    expect(blocks.at(-1)).toBe('huomio');
    expect([...blocks, 'images']).toContain('images');
  });
});

describe('offer signature', () => {
  it('prints seller and customer once, after Lisätiedot and the seller block, before the KTV page', () => {
    const company = {
      ...defaultCompanyProfile,
      sellerName: 'Aada Asentaja',
      companyName: 'Kuvitteellinen Oy',
    };
    const ctx = buildPdfContext(
      input(record({ name: 'Matti Meikäläinen' }, { projectName: 'Matti Meikäläinen' }), {
        company,
        offerCompany: { ...input(record({})).offerCompany, additionalInfoText: 'Maksuehto.' },
      }),
    );
    const before = ctx.price;
    const html = renderTarjousHtml(ctx);
    expect(ctx.price).toEqual(before);
    expect(html.match(/class="offer-sign"/g)).toHaveLength(1);
    expect(html).toContain('Aada Asentaja');
    expect(html).toContain('Kuvitteellinen Oy');
    expect(html).toContain('>Myyjä<');
    expect(html).toContain('>Tilaaja<');
    expect(html).toContain('Allekirjoitus');
    expect(html).toContain('Päiväys');
    expect((html.match(/class="offer-sign-line"/g) ?? []).length).toBe(4);
    const pen = html.match(/<tr class="offer-sign-pen">([\s\S]*?)<\/tr>/);
    const date = html.match(/<tr class="offer-sign-date">([\s\S]*?)<\/tr>/);
    expect(pen?.[1].match(/Allekirjoitus/g)).toHaveLength(2);
    expect(pen?.[1].match(/class="offer-sign-line"/g)).toHaveLength(2);
    expect(date?.[1].match(/Päiväys/g)).toHaveLength(2);
    expect(date?.[1].match(/class="offer-sign-line"/g)).toHaveLength(2);
    expect(html).toContain('break-inside: avoid');
    const at = (needle: string) => html.indexOf(needle);
    expect(at('class="offer-sign"')).toBeGreaterThan(at('Lisätiedot:'));
    expect(at('class="offer-sign"')).toBeGreaterThan(at('class="offer-seller"'));
    expect(at('class="offer-sign"')).toBeLessThan(at('class="ktv-page page-break"'));
    expect(html).toContain('Loppusumma');
  });

  it('omits missing seller and customer values and still prints the blank lines', () => {
    const company = {
      ...defaultCompanyProfile,
      sellerName: '',
      companyName: '',
      sellerPhone: '',
      sellerEmail: '',
      phone: '',
      email: '',
    };
    expect(offerSignatureParties(company, '  ').sellerLines).toEqual([]);
    expect(offerSignatureParties(company, '  ').customerName).toBe('');
    const html = renderTarjousHtml(
      buildPdfContext(input(record({ name: '' }, { projectName: '' }), { company })),
    );
    const block = html.slice(html.indexOf('class="offer-sign"'), html.indexOf('class="ktv-page'));
    expect(block).toContain('>Myyjä<');
    expect(block).toContain('>Tilaaja<');
    expect(block).not.toContain('undefined');
    expect(block).not.toContain('null');
    expect((block.match(/class="offer-sign-detail"/g) ?? []).length).toBe(0);
    expect((block.match(/class="offer-sign-line"/g) ?? []).length).toBe(4);
    expect(html.match(/class="offer-sign"/g)).toHaveLength(1);
  });
});
