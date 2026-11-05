import { buildPdfContext, offerMaterialsVatIncluded } from '../src/core/pdf/buildPdfContext';
import { kotitalousDeduction } from '../src/core/pdf/kotitalousDeduction';
import { renderKotitalousPageHtml } from '../src/core/pdf/renderKotitalousPageHtml';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { calculationWithBusinessVatMode } from '../src/core/pdf/urakkakorttiCard';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { filterOfferCards, specCardsFromSnapshot } from '../src/core/pdf/offerPageSpecs';
import { specGridLayout } from '../src/core/pdf/specGridLayout';
import { form, input, line, record, snapshot } from './pdfFixtures';

const allKeys = (value: unknown): string[] =>
  value && typeof value === 'object'
    ? Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [k, ...allKeys(v)])
    : [];

const labels = (rows: { label: string }[]) => rows.map((row) => row.label);

describe('specGridLayout', () => {
  const card = (title: string) => ({ pageId: title, title, rows: [{ label: 'a', value: '1' }] });
  it('0 cards -> none, 1 -> full width, 2+ -> grid', () => {
    expect(specGridLayout([])).toEqual({ mode: 'none', cards: [] });
    expect(specGridLayout([{ pageId: 'x', title: 'x', rows: [] }]).mode).toBe('none');
    const single = specGridLayout([card('A')]);
    expect(single.mode).toBe('single');
    expect(single.cards[0].fullWidth).toBe(true);
    const grid = specGridLayout([card('A'), card('B'), card('C')]);
    expect(grid.mode).toBe('grid');
    expect(grid.cards.map((c) => c.fullWidth)).toEqual([false, false, false]);
  });
});

describe('offerPageSpecs', () => {
  it('groups snapshot fields by form page using the field key', () => {
    const cards = specCardsFromSnapshot(snapshot('120'), form);
    expect(cards).toHaveLength(1);
    expect(cards[0].pageId).toBe('page_surfaces');
    expect(cards[0].rows[0]).toEqual({ label: 'Kiinteä seinäpinta-ala', value: '120,0 m²' });
  });

  it('still maps when the page was renamed after the snapshot', () => {
    const renamed = { ...form, pages: form.pages.map((p) => (p.id === 'page_surfaces' ? { ...p, title: 'Alat' } : p)) };
    const cards = specCardsFromSnapshot(snapshot('50'), renamed);
    expect(cards[0]).toMatchObject({ pageId: 'page_surfaces', title: 'Alat' });
  });

  it('drops unknown pages and disabled pages from the offer', () => {
    const snap = { ...snapshot('50'), fields: [{ key: 'gone', label: 'Vanha', value: '1', pageTitle: 'Poistettu' }] };
    const cards = specCardsFromSnapshot(snap, form);
    expect(cards[0].pageId).toBeNull();
    expect(filterOfferCards(cards, new Set(['page_surfaces']))).toEqual([]);
    expect(filterOfferCards(specCardsFromSnapshot(snapshot('5'), form), new Set())).toEqual([]);
  });
});

describe('offerMaterialsVatIncluded', () => {
  const legacy = (materialsVat0: number, vatPercent: number) =>
    Math.round(materialsVat0 * (1 + vatPercent / 100) * 100) / 100;

  it('matches the stored aggregate for a single rate and when there are no priced lines', () => {
    const single = record({}, { materialsVat0: 400, vatPercent: 25.5 });
    expect(offerMaterialsVatIncluded(single)).toBe(legacy(400, 25.5));
    expect(offerMaterialsVatIncluded(single)).toBe(502);
    const none = record({}, {
      materialsVat0: 400,
      vatPercent: 25.5,
      structureLines: [{ ...line('l1', 's1', 'Ulkomaalaus'), quantity: 0, materialsVat0: 999, vatPercent: 10 }],
    });
    expect(offerMaterialsVatIncluded(none)).toBe(502);
  });

  it('sums each line at its own rate, and a missing line rate uses the record rate', () => {
    const mixed = record({}, {
      materialsVat0: 150,
      vatPercent: 25.5,
      structureLines: [
        { ...line('a', 's1', 'A'), materialsVat0: 100, vatPercent: 25.5 },
        { ...line('b', 's2', 'B'), materialsVat0: 50, vatPercent: 10 },
      ],
    });
    expect(offerMaterialsVatIncluded(mixed)).toBe(180.5);
    expect(offerMaterialsVatIncluded(mixed)).not.toBe(legacy(150, 25.5));
    const fallback = record({}, {
      materialsVat0: 150,
      vatPercent: 25.5,
      structureLines: [
        { ...line('a', 's1', 'A'), materialsVat0: 100, vatPercent: Number.NaN },
        { ...line('b', 's2', 'B'), materialsVat0: 50, vatPercent: 10 },
      ],
    });
    expect(offerMaterialsVatIncluded(fallback)).toBe(180.5);
  });

  it('applies a uniform discount once to the single-rate aggregate, and a calc-level percent the same way', () => {
    const uniform = record({}, {
      materialsVat0: 400,
      vatPercent: 25.5,
      discountPercent: 10,
      structureLines: [
        { ...line('a', 's1', 'A'), materialsVat0: 200, discountPercent: 10, vatPercent: 25.5 },
        { ...line('b', 's1', 'B'), materialsVat0: 200, discountPercent: 10, vatPercent: 25.5 },
      ],
    });
    expect(offerMaterialsVatIncluded(uniform)).toBe(451.8);
    const calc = record({}, {
      materialsVat0: 400,
      vatPercent: 25.5,
      discountPercent: 10,
      structureLines: [{ ...line('a', 's1', 'A'), materialsVat0: 200, discountPercent: 0, vatPercent: 25.5 }],
    });
    expect(offerMaterialsVatIncluded(calc)).toBe(451.8);
    const none = record({}, {
      materialsVat0: 400,
      vatPercent: 25.5,
      discountPercent: 10,
      structureLines: [{ ...line('l1', 's1', 'Ulkomaalaus'), quantity: 0, materialsVat0: 999, vatPercent: 10 }],
    });
    expect(offerMaterialsVatIncluded(none)).toBe(451.8);
  });

  it('sums non-uniform line discounts per line on one rate, and a calc-level percent per line on mixed rates', () => {
    const uneven = record({}, {
      materialsVat0: 400,
      vatPercent: 25.5,
      structureLines: [
        { ...line('a', 's1', 'A'), materialsVat0: 200, discountPercent: 10, vatPercent: 25.5 },
        { ...line('b', 's1', 'B'), materialsVat0: 200, discountPercent: 0, vatPercent: 25.5 },
      ],
    });
    expect(offerMaterialsVatIncluded(uneven)).toBe(476.9);
    expect(offerMaterialsVatIncluded(uneven)).not.toBe(451.8);
    const mixedCalc = record({}, {
      materialsVat0: 150,
      vatPercent: 25.5,
      discountPercent: 10,
      structureLines: [
        { ...line('a', 's1', 'A'), materialsVat0: 100, discountPercent: 0, vatPercent: 25.5 },
        { ...line('b', 's2', 'B'), materialsVat0: 50, discountPercent: 0, vatPercent: 10 },
      ],
    });
    expect(offerMaterialsVatIncluded(mixedCalc)).toBe(162.45);
  });
});

describe('buildPdfContext', () => {
  it('private customer: VAT-inclusive price block, no Ale row at 0 %, KTV data present', () => {
    const ctx = buildPdfContext(input(record({})));
    expect(ctx.price.includesVat).toBe(true);
    expect(labels(ctx.price.rows)).toEqual(['Yhteensä alv 0', 'Alv 25,5 %', 'Yhteensä sis. alv']);
    expect(ctx.price.rows.at(-1)?.emphasis).toBe(true);
    expect(ctx.price.rows.map((row) => row.value.replace(/\s/g, ' '))).toEqual([
      '1 000,00 €',
      '255,00 €',
      '1 255,00 €',
    ]);
    expect(ctx.ktv).toEqual({
      totalPriceVat: 1255,
      materialsVat: 502,
      settings: { ratePercent: 40, deductibleEur: 150, capEur: 2100 },
      footnoteText: '',
      persons: 1,
      totalLabel: 'Yhteensä sis. alv',
    });
    expect(ctx.customerLines).toEqual(['Matti Meikäläinen', 'Testitie 1, 20100 Turku', '040 000 0000']);
    expect(ctx.offerInfo).toEqual([
      { label: 'Tarjousnumero', value: '10285' },
      { label: 'Päiväys', value: '10.10.2026' },
      { label: 'Voimassa', value: '10.11.2026' },
    ]);
    expect(ctx.additionalInfo).toBe('');
    expect(ctx.sections).toHaveLength(1);
    expect(ctx.sections[0].title).toBe('Ulkomaalaus');
    expect(ctx.sections[0].textGroups.find((group) => group.group === 'muuta')?.items).toEqual(['Sisältää telineet.']);
    expect(ctx.sections[0].tableRows).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Työn arvioitu kesto', value: '4 työpäivää' })]),
    );
    expect(ctx.rows.map((row) => row.name)).toEqual(['Ulkomaalaus']);
    expect(ctx.deliveryScheduleText).toBe('');
    expect(ctx.vatSummary).toEqual([{ vatPercent: 25.5, net: 2000, vat: 510, gross: 2510 }]);
    expect(ctx.sellerLines).toEqual(['Puh. +358 40 938 9403', 'info@colorajaton.fi']);
    expect(ctx).not.toHaveProperty('specGrid');
    expect(ctx.footer.left).toEqual(['ColoRajaton Oy', 'Toivonlinnantie 350', '21500 Piikkiö']);
    expect(ctx.footer.right).toEqual(['Y-tunnus: 3224017-2', 'Puh. +358 40 938 9403']);
  });

  it('private customer with a record discount and undiscounted lines: same labels, stored Alennettu hinta', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: [{ ...line('l1', 's1', 'Ulkomaalaus'), quantity: 1, unitPriceVat0: 2000, discountPercent: 0, vatPercent: 25.5 }],
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 2000,
          totalPriceVatBeforeDiscount: 2510,
          totalPriceVat0: 1800,
          vatAmount: 459,
          totalPriceVat: 2259,
        }),
      ),
    );
    expect(labels(ctx.price.rows)).toEqual([
      'Rivit yhteensä',
      'Alennus yhteensä 10 %',
      'Alennettu hinta yhteensä',
      'Sisältää ALV 25,5 %',
    ]);
    expect(ctx.price.rows.map((r) => r.value.replace(/\s/g, ' '))).toEqual([
      '2 510,00 €',
      '−251,00 €',
      '2 259,00 €',
      '459,00 €',
    ]);
    expect(ctx.ktv).toMatchObject({
      totalPriceVat: 2259,
      materialsVat: 451.8,
      totalLabel: 'Alennettu hinta yhteensä',
    });
  });

  it('private lines with 10 % discount: list-price headings, reconciling block, KTV uses the same Loppusumma', () => {
    const lines = [
      { ...line('a', 's1', 'Pohjatyö'), quantity: 1, unit: 'erä', unitPriceVat0: 1000, discountPercent: 10, vatPercent: 25.5 },
      { ...line('b', 's2', 'Sokkeli'), quantity: 12, unit: 'm²', unitPriceVat0: 80, discountPercent: 10, vatPercent: 25.5 },
    ];
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: lines,
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 1960,
          totalPriceVat0: 1764,
          totalPriceVatBeforeDiscount: 2459.8,
          totalPriceVat: 2213.82,
          vatAmount: 449.82,
          vatPercent: 25.5,
          materialsVat0: 400,
        }),
      ),
    );
    expect(labels(ctx.price.rows)).toEqual([
      'Yhteensä alv 0',
      'Alv 25,5 %',
      'Yhteensä sis. alv',
      'Alennus yhteensä 10 %',
      'Alennettu hinta yhteensä',
    ]);
    expect(ctx.price.rows.map((r) => r.value.replace(/\s/g, ' '))).toEqual([
      '1 960,00 €',
      '499,80 €',
      '2 459,80 €',
      '−245,98 €',
      '2 213,82 €',
    ]);
    const parseEuro = (value: string) => Number(value.replace(/\s/g, '').replace('€', '').replace(',', '.'));
    const yht = Math.round(ctx.sections.reduce((sum, section) => sum + parseEuro(section.heading?.price ?? ''), 0) * 100) / 100;
    expect(yht).toBe(2459.8);
    expect(ctx.sections.map((section) => section.heading?.price.replace(/\s/g, ' '))).toEqual(['1 255,00 €', '1 204,80 €']);
    const sis = ctx.price.rows.find((row) => row.label === 'Yhteensä sis. alv');
    const ale = ctx.price.rows.find((row) => row.label.startsWith('Alennus'));
    const after = ctx.price.rows.find((row) => row.label === 'Alennettu hinta yhteensä');
    expect(parseEuro(sis?.value ?? '')).toBe(yht);
    const alennus = Number((ale?.value ?? '').replace(/[^\d,]/g, '').replace(',', '.'));
    expect(Math.round((parseEuro(sis?.value ?? '') - alennus) * 100) / 100).toBe(2213.82);
    expect(parseEuro(after?.value ?? '')).toBe(2213.82);
    expect(ctx.ktv).toMatchObject({
      totalPriceVat: 2213.82,
      materialsVat: 451.8,
      totalLabel: 'Alennettu hinta yhteensä',
    });
    const ktv = renderKotitalousPageHtml(ctx).replace(/\s/g, ' ');
    expect(ktv).toContain('Alennettu hinta yhteensä');
    expect(ktv).toContain('2 213,82 €');
    expect(ktv).toContain('1 762,02 €');
    expect(ktv).toContain('704,81 €');
    expect(ktv).toContain('554,81 €');
    expect(ktv).toContain('451,80 €');
    expect(ktv).toContain('Arvioitu hinta vähennyksen jälkeen');
    expect(ktv).toContain('2 213,82 € − 554,81 €');
    expect(ktv).toContain('1 659,01 €');
    expect(ktv).not.toContain('Asiakkaan maksettavaksi');
    expect(ktv).not.toContain('Enimmäismäärä');
    expect(ktv).not.toContain('2 459,80 €');
  });

  it('business customer with discount: alv0 uses the same labels and net amounts', () => {
    const ctx = buildPdfContext(
      input(
        record({ customerType: 'business', reverseVat: true }, {
          structureLines: [{ ...line('l1', 's1', 'Urakka'), quantity: 1, unitPriceVat0: 2000, discountPercent: 0, vatPercent: 25.5 }],
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 2000,
          totalPriceVat0: 1800,
          totalPriceVatBeforeDiscount: 2000,
          totalPriceVat: 1800,
        }),
      ),
    );
    expect(labels(ctx.price.rows)).toEqual(['Rivit yhteensä', 'Alennus yhteensä 10 %', 'Alennettu hinta yhteensä']);
    expect(ctx.price.rows.map((row) => row.value.replace(/\s/g, ' '))).toEqual(['2 000,00 €', '−200,00 €', '1 800,00 €']);
    expect(ctx.ktv).toBeUndefined();
  });

  it('business customer: alv0 only, no VAT rows, no reverse VAT text, no KTV', () => {
    const ctx = buildPdfContext(input(record({ customerType: 'business' })));
    expect(ctx.price.includesVat).toBe(false);
    expect(labels(ctx.price.rows)).toEqual(['Loppusumma (Alv 0 %)']);
    expect(JSON.stringify(ctx)).not.toMatch(/Käänteinen|ALV \d/);
    expect(ctx.ktv).toBeUndefined();
    expect(ctx.vatSummary).toEqual([]);
  });

  it('reverse VAT: alv0 prices and no KTV page', () => {
    const ctx = buildPdfContext(input(record({ customerType: 'business', reverseVat: true })));
    expect(labels(ctx.price.rows)).toEqual(['Loppusumma (Alv 0 %)']);
    expect(ctx.price.rows.some((row) => row.label.startsWith('Sisältää ALV') || /^Alv \d/.test(row.label))).toBe(false);
    expect(JSON.stringify(ctx.price)).not.toContain('Käänteinen ALV');
    expect(ctx.price.rows[0].value.replace(/\s/g, ' ')).toBe('1 000,00 €');
    expect(ctx.price.includesVat).toBe(false);
    expect(ctx.ktv).toBeUndefined();
    expect(ctx.vatSummary).toEqual([]);
  });

  it('legacy record without snapshot: manual row, no section, no offer number row when not assigned', () => {
    const ctx = buildPdfContext(
      input(record({}, { structureLines: undefined, formSnapshot: undefined }), {
        offerNumber: undefined,
        structures: [],
      }),
    );
    expect(ctx.sections.map((section) => section.title)).toEqual(['Laskenta']);
    expect(ctx.sections[0].textGroups).toEqual([]);
    expect(ctx.sections[0].heading?.price).toBeTruthy();
    expect(ctx.rows.map((row) => row.name)).toEqual(['Laskenta']);
    expect(ctx).not.toHaveProperty('specGrid');
    expect(labels(ctx.offerInfo)).toEqual(['Päiväys', 'Voimassa']);
    expect(ctx.additionalInfo).toBe('');
  });

  it('multi-structure: each structure section gets its own Tarjous text', () => {
    const ctx = buildPdfContext(
      input(record({}, { structureLines: [line('l2', 's2', 'Sokkeli', '30'), line('l1', 's1', 'Ulkomaalaus')] })),
    );
    expect(ctx.rows.map((row) => row.name)).toEqual(['Sokkeli', 'Ulkomaalaus']);
    expect(ctx.sections.map((section) => section.title)).toEqual(['Sokkeli', 'Ulkomaalaus']);
    expect(ctx.sections.map((section) => section.textGroups.find((group) => group.group === 'muuta')?.items)).toEqual([
      ['Toinen teksti'],
      ['Sisältää telineet.'],
    ]);
    expect(ctx.additionalInfo).toBe('');
  });

  it('ignores stored offer page switches', () => {
    const ctx = buildPdfContext(
      input(record({}), {
        offerStructureSettings: {
          s1: { additionalInfoText: '', offerPages: [{ pageId: 'page_surfaces', enabled: false }] },
        },
      }),
    );
    expect(ctx.sections).toHaveLength(1);
    expect(ctx.sections[0].tableRows.some((row) => row.value.includes('120 m'))).toBe(true);
    expect(ctx.sections[0].tableRows.some((row) => row.value.includes('120,0'))).toBe(false);
  });

  it('odd price 55,98 net at 10 %: Alennus is the residual so the block reconciles', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: [{ ...line('a', 's1', 'Lista'), quantity: 1, unitPriceVat0: 55.98, discountPercent: 10, vatPercent: 25.5 }],
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 55.98,
          totalPriceVat0: 50.38,
          totalPriceVatBeforeDiscount: 70.25,
          totalPriceVat: 63.22,
          vatPercent: 25.5,
          materialsVat0: 0,
        }),
      ),
    );
    expect(ctx.price.rows.map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`)).toEqual([
      'Yhteensä alv 0=55,98 €',
      'Alv 25,5 %=14,27 €',
      'Yhteensä sis. alv=70,25 €',
      'Alennus yhteensä 10 %=−7,02 €',
      'Alennettu hinta yhteensä=63,23 €',
    ]);
    expect(ctx.price.rows.find((row) => row.label === 'Alennettu hinta yhteensä')?.emphasis).toBe(true);
    expect(ctx.ktv?.totalPriceVat).toBe(63.23);
    const html = renderTarjousHtml(ctx).replace(/\s/g, ' ');
    const ktv = html.slice(html.indexOf('class="ktv-page'));
    expect(ktv).toContain('63,23 €');
    expect(ktv).not.toContain('63,22 €');
    expect(html).toContain('63,23 €');
    expect(html).not.toContain('63,22 €');
  });

  it('legacy 90,60 net at 5 %: stored Loppusumma 108,02 and Alennus 5,68', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: [{ ...line('a', 's1', 'Lista'), quantity: 1, unitPriceVat0: 90.6, discountPercent: 0, vatPercent: 25.5 }],
          discountPercent: 5,
          totalPriceVat0BeforeDiscount: 90.6,
          totalPriceVat0: 86.07,
          totalPriceVatBeforeDiscount: 113.7,
          totalPriceVat: 108.02,
          vatPercent: 25.5,
          materialsVat0: 0,
        }),
      ),
    );
    expect(ctx.price.rows.map((row) => row.value.replace(/\s/g, ' '))).toEqual([
      '113,70 €',
      '−5,68 €',
      '108,02 €',
      '21,95 €',
    ]);
    expect(ctx.price.rows[1].label).toBe('Alennus yhteensä 5 %');
    expect(ctx.ktv?.totalPriceVat).toBe(108.02);
  });

  it('business alv0 and reverse VAT without discount: 3 x 2,5 x 10,01 uses the rounded line sum', () => {
    const lines = [0, 1, 2].map((index) => ({
      ...line(`a${index}`, 's1', `Osa ${index}`),
      quantity: 2.5,
      unitPriceVat0: 10.01,
      discountPercent: 0,
      vatPercent: 25.5,
      materialsVat0: 0,
    }));
    const stored = 2.5 * 10.01 * 3;
    const customers = [
      { customerType: 'business' as const },
      { customerType: 'business' as const, reverseVat: true },
      { customerType: 'private' as const, reverseVat: true },
    ];
    for (const customer of customers) {
      const base = record(customer, {
        structureLines: lines,
        discountPercent: 0,
        totalPriceVat0: stored,
        totalPriceVat0BeforeDiscount: stored,
        totalPriceVat: stored,
        totalPriceVatBeforeDiscount: stored,
        vatAmount: 0,
        vatPercent: 25.5,
        materialsVat0: 0,
      });
      const rec = customer.customerType === 'business' && !customer.reverseVat
        ? calculationWithBusinessVatMode(base, 'alv0')
        : base;
      const ctx = buildPdfContext(input(rec));
      expect(ctx.sections.map((section) => section.heading?.price.replace(/\s/g, ' '))).toEqual([
        '25,03 €',
        '25,03 €',
        '25,03 €',
      ]);
      expect(ctx.price.rows.map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`)).toEqual([
        'Loppusumma (Alv 0 %)=75,09 €',
      ]);
      expect(ctx.ktv).toBeUndefined();
    }
  });

  it('private without discount: 3 x 10,01 uses rounded line totals, Veroton + ALV = Loppusumma, KTV matches', () => {
    const lines = [0, 1, 2].map((index) => ({
      ...line(`a${index}`, 's1', `Osa ${index}`),
      quantity: 1,
      unitPriceVat0: 10.01,
      discountPercent: 0,
      vatPercent: 25.5,
      materialsVat0: 0,
    }));
    const storedGross = 30.03 * 1.255;
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: lines,
          discountPercent: 0,
          totalPriceVat0BeforeDiscount: 30.03,
          totalPriceVat0: 30.03,
          totalPriceVatBeforeDiscount: storedGross,
          totalPriceVat: storedGross,
          vatAmount: storedGross - 30.03,
          vatPercent: 25.5,
          materialsVat0: 0,
        }),
      ),
    );
    expect(ctx.sections.map((section) => section.heading?.price.replace(/\s/g, ' '))).toEqual([
      '12,56 €',
      '12,56 €',
      '12,56 €',
    ]);
    expect(ctx.price.rows.map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`)).toEqual([
      'Yhteensä alv 0=30,03 €',
      'Alv 25,5 %=7,65 €',
      'Yhteensä sis. alv=37,68 €',
    ]);
    const parseEuro = (value: string) => Number(value.replace(/[^\d,]/g, '').replace(',', '.'));
    const [net, vat, gross] = ctx.price.rows.map((row) => parseEuro(row.value));
    expect(net + vat).toBe(gross);
    expect(gross).toBe(37.68);
    expect(ctx.ktv?.totalPriceVat).toBe(37.68);
    const html = renderTarjousHtml(ctx).replace(/\s/g, ' ');
    const totals = html.slice(html.indexOf('class="price-block offer-totals"'), html.indexOf('class="ktv-page'));
    const ktv = html.slice(html.indexOf('class="ktv-page'));
    expect(totals).toContain('37,68 €');
    expect(totals).not.toContain('37,69 €');
    expect(ktv).toContain('37,68 €');
    expect(ktv).not.toContain('37,69 €');
  });

  it('line-sum and stored total differ by 1 cent: page 1 and KTV show the line sum', () => {
    const lines = [0, 1, 2].map((index) => ({
      ...line(`a${index}`, 's1', `Osa ${index}`),
      quantity: 1,
      unitPriceVat0: 10.01,
      discountPercent: 10,
      vatPercent: 25.5,
    }));
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: lines,
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 30.03,
          totalPriceVat0: 27.03,
          totalPriceVatBeforeDiscount: 37.69,
          totalPriceVat: 33.92,
          vatPercent: 25.5,
          materialsVat0: 0,
        }),
      ),
    );
    expect(ctx.price.rows.find((row) => row.label === 'Alennettu hinta yhteensä')?.value.replace(/\s/g, ' ')).toBe('33,93 €');
    expect(ctx.price.rows.find((row) => row.label.startsWith('Alennus'))?.value.replace(/\s/g, ' ')).toBe('−3,75 €');
    expect(ctx.ktv?.totalPriceVat).toBe(33.93);
    const html = renderTarjousHtml(ctx).replace(/\s/g, ' ');
    const totals = html.slice(html.indexOf('class="price-block offer-totals"'), html.indexOf('class="ktv-page'));
    const ktv = html.slice(html.indexOf('class="ktv-page'));
    expect(totals).toContain('33,93 €');
    expect(totals).not.toContain('33,92 €');
    expect(ktv).toContain('33,93 €');
    expect(ktv).not.toContain('33,92 €');
  });

  it('business sis odd price uses the same inclusive block and a VAT line from Loppusumma', () => {
    const rec = calculationWithBusinessVatMode(
      record({ customerType: 'business' }, {
        structureLines: [{ ...line('a', 's1', 'Lista'), quantity: 1, unitPriceVat0: 55.98, discountPercent: 10, vatPercent: 25.5 }],
        discountPercent: 10,
        totalPriceVat0BeforeDiscount: 55.98,
        totalPriceVat0: 50.38,
        totalPriceVatBeforeDiscount: 70.25,
        totalPriceVat: 63.22,
        vatPercent: 25.5,
      }),
      'sis',
    );
    const ctx = buildPdfContext(input(rec));
    expect(ctx.price.rows.map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`)).toEqual([
      'Yhteensä alv 0=55,98 €',
      'Alv 25,5 %=14,27 €',
      'Yhteensä sis. alv=70,25 €',
      'Alennus yhteensä 10 %=−7,02 €',
      'Alennettu hinta yhteensä=63,23 €',
    ]);
    expect(ctx.ktv).toBeUndefined();
    expect(ctx.sections[0].heading?.price.replace(/\s/g, ' ')).toBe('70,25 €');
  });

  it('alv0 odd price reconciles the net discount the same way', () => {
    const ctx = buildPdfContext(
      input(
        record({ customerType: 'business' }, {
          structureLines: [{ ...line('a', 's1', 'Lista'), quantity: 1, unitPriceVat0: 33.35, discountPercent: 10, vatPercent: 25.5 }],
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 33.35,
          totalPriceVat0: 30.02,
          totalPriceVatBeforeDiscount: 33.35,
          totalPriceVat: 30.02,
          vatPercent: 25.5,
        }),
      ),
    );
    expect(ctx.price.rows.map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`)).toEqual([
      'Yhteensä alv 0=33,35 €',
      'Alennus yhteensä 10 %=−3,33 €',
      'Loppusumma (Alv 0 %)=30,02 €',
    ]);
    expect(ctx.price.rows.some((row) => row.label.startsWith('Sisältää ALV') || /^Alv \d/.test(row.label))).toBe(false);
  });

  it('calc-level discount with two VAT rates prints no VAT table', () => {
    const totals = {
      structureLines: [
        { ...line('a', 's1', 'A'), quantity: 1, unitPriceVat0: 100, discountPercent: 0, vatPercent: 25.5 },
        { ...line('b', 's1', 'B'), quantity: 1, unitPriceVat0: 100, discountPercent: 0, vatPercent: 10 },
      ],
      discountPercent: 10,
      vatPercent: 25.5,
      totalPriceVat0BeforeDiscount: 200,
      totalPriceVat0: 180,
      totalPriceVatBeforeDiscount: 235.5,
      totalPriceVat: 211.95,
      vatAmount: 31.95,
      materialsVat0: 0,
    };
    const cases = [
      record({}, totals),
      calculationWithBusinessVatMode(record({ customerType: 'business', name: 'Kuvitteellinen Oy' }, totals), 'sis'),
    ];
    for (const rec of cases) {
      const ctx = buildPdfContext(input(rec));
      expect(ctx.vatSummary).toEqual([]);
      expect(renderTarjousHtml(ctx)).not.toContain('class="offer-vat"');
      expect(ctx.price.rows.map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`)).toEqual([
        'Rivit yhteensä=235,50 €',
        'Alennus yhteensä 10 %=−23,55 €',
        'Alennettu hinta yhteensä=211,95 €',
      ]);
      const amounts = ctx.price.rows.map((row) => Number(row.value.replace(/[^\d,.-]/g, '').replace(',', '.')));
      expect(ctx.price.rows.some((row) => row.label.startsWith('Alv ') || row.label.startsWith('Sisältää ALV'))).toBe(false);
      expect(Math.round((amounts[0] - amounts[1]) * 100) / 100).toBe(211.95);
      expect(amounts[2]).toBe(rec.totalPriceVat);
    }
    expect(buildPdfContext(input(cases[0])).ktv?.totalPriceVat).toBe(cases[0].totalPriceVat);
    expect(buildPdfContext(input(cases[1])).ktv).toBeUndefined();
  });

  it('multi-rate line discount lists list-price VAT rows, then the discount, and a list-price VAT table', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: [
            { ...line('a', 's1', 'A'), quantity: 1, unitPriceVat0: 100, discountPercent: 10, vatPercent: 25.5 },
            { ...line('b', 's1', 'B'), quantity: 1, unitPriceVat0: 100, discountPercent: 10, vatPercent: 10 },
          ],
          discountPercent: 10,
          vatPercent: 25.5,
          totalPriceVat0BeforeDiscount: 200,
          totalPriceVat0: 180,
          totalPriceVatBeforeDiscount: 235.5,
          totalPriceVat: 211.95,
          materialsVat0: 0,
        }),
      ),
    );
    expect(ctx.price.rows.map((row) => row.label)).toEqual([
      'Yhteensä alv 0',
      'Alv 25,5 %',
      'Alv 10 %',
      'Yhteensä sis. alv',
      'Alennus yhteensä 10 %',
      'Alennettu hinta yhteensä',
      'Sisältää ALV 25,5 %',
      'Sisältää ALV 10 %',
    ]);
    expect(ctx.price.rows.map((row) => row.value.replace(/\s/g, ' '))).toEqual([
      '200,00 €',
      '25,50 €',
      '10,00 €',
      '235,50 €',
      '−23,55 €',
      '211,95 €',
      '22,95 €',
      '9,00 €',
    ]);
    expect(ctx.vatSummary).toEqual([
      { vatPercent: 25.5, net: 100, vat: 25.5, gross: 125.5 },
      { vatPercent: 10, net: 100, vat: 10, gross: 110 },
    ]);
    const html = renderTarjousHtml(ctx);
    expect(html.indexOf('class="offer-vat"')).toBeLessThan(html.indexOf('Yhteensä alv 0'));
    expect(html).toContain('>Netto</th>');
  });

  it('uses each line rate for KTV materials and keeps the single-rate aggregate', () => {
    const single = buildPdfContext(input(record({})));
    expect(single.ktv?.materialsVat).toBe(502);
    expect(single.ktv?.materialsVat).toBe(offerMaterialsVatIncluded(record({})));
    const lines = [
      { ...line('a', 's1', 'A'), quantity: 1, unitPriceVat0: 1000, materialsVat0: 100, discountPercent: 0, vatPercent: 25.5 },
      { ...line('b', 's2', 'B'), quantity: 1, unitPriceVat0: 500, materialsVat0: 50, discountPercent: 0, vatPercent: 10 },
    ];
    const mixedRecord = record({}, {
      vatPercent: 25.5,
      materialsVat0: 150,
      structureLines: lines,
      totalPriceVat0: 1500,
      vatAmount: 305,
      totalPriceVat: 1805,
    });
    const mixed = buildPdfContext(input(mixedRecord));
    expect(mixed.ktv?.materialsVat).toBe(180.5);
    expect(mixed.ktv?.totalPriceVat).toBe(1805);
    const ktv = renderKotitalousPageHtml(mixed).replace(/\s/g, ' ');
    expect(ktv).toContain('180,50 €');
    expect(ktv).toContain('1 624,50 €');
    const discounted = buildPdfContext(
      input(
        record({}, {
          ...mixedRecord,
          structureLines: lines.map((item) => ({ ...item, discountPercent: 10 })),
          discountPercent: 10,
        }),
      ),
    );
    expect(discounted.ktv?.materialsVat).toBe(162.45);
    expect(discounted.ktv?.totalPriceVat).toBe(1624.5);
  });

  it('10 % line discount on two rates: materials 162,45 and the 2 038,16 work share', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          vatPercent: 25.5,
          materialsVat0: 150,
          discountPercent: 10,
          structureLines: [
            { ...line('a', 's1', 'A'), quantity: 1, unitPriceVat0: 1155, materialsVat0: 100, discountPercent: 10, vatPercent: 25.5 },
            { ...line('b', 's2', 'B'), quantity: 1, unitPriceVat0: 741, materialsVat0: 50, discountPercent: 10, vatPercent: 10 },
          ],
        }),
      ),
    );
    expect(ctx.ktv?.materialsVat).toBe(162.45);
    expect(ctx.ktv?.totalPriceVat).toBe(2038.16);
    const result = kotitalousDeduction({
      totalPriceVat: ctx.ktv!.totalPriceVat,
      materialsVat: ctx.ktv!.materialsVat,
      settings: ctx.ktv!.settings,
    });
    expect(result.workShareVatIncluded).toBe(1875.71);
    expect(result.grossDeduction).toBe(750.28);
    expect(result.deductionAmount).toBe(600.28);
    expect(result.personsUsed).toBe(1);
    expect(result.persons).toBe(1);
  });

  it('prints a zero VAT row when a 0 % line is mixed with 25,5 %', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          structureLines: [
            { ...line('a', 's1', 'A'), quantity: 1, unitPriceVat0: 100, materialsVat0: 0, discountPercent: 0, vatPercent: 25.5 },
            { ...line('b', 's2', 'B'), quantity: 1, unitPriceVat0: 50, materialsVat0: 0, discountPercent: 0, vatPercent: 0 },
          ],
          vatPercent: 25.5,
          materialsVat0: 0,
        }),
      ),
    );
    expect(ctx.price.rows.map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`)).toEqual([
      'Yhteensä alv 0=150,00 €',
      'Alv 25,5 %=25,50 €',
      'Alv 0 %=0,00 €',
      'Yhteensä sis. alv=175,50 €',
    ]);
    expect(ctx.price.rows.some((row) => row.label.startsWith('Sisältää ALV'))).toBe(false);
  });

  it('urakkakortti does not reuse the offer discount block', () => {
    const source = input(
      record({}, {
        structureLines: [{ ...line('a', 's1', 'Lista'), quantity: 1, unitPriceVat0: 55.98, discountPercent: 10, contractPriceVat0: 1000 }],
        discountPercent: 10,
      }),
    );
    const card = renderUrakkakorttiHtml(buildUrakkakorttiContext(source));
    expect(card).not.toContain('Rivit yhteensä');
    expect(card).not.toContain('Alennettu hinta');
    expect(card).not.toContain('A-hinta');
    expect(card.replace(/\s/g, ' ')).toContain('1 000,00');
  });

  it('never contains margin or commission data', () => {
    for (const customer of [{}, { customerType: 'business' as const }, { customerType: 'business' as const, reverseVat: true }]) {
      const ctx = buildPdfContext(input(record(customer)));
      const keys = allKeys(ctx).map((k) => k.toLowerCase());
      expect(keys.some((k) => k.includes('margin') || k.includes('commission') || k.includes('kate') || k.includes('palkkio'))).toBe(false);
      const text = JSON.stringify(ctx);
      expect(text).not.toMatch(/333[,.]33|77[,.]77/);
    }
  });
});
