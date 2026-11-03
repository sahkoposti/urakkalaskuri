import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
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

describe('buildPdfContext', () => {
  it('private customer: VAT-inclusive price block, no Ale row at 0 %, KTV data present', () => {
    const ctx = buildPdfContext(input(record({})));
    expect(ctx.price.includesVat).toBe(true);
    expect(labels(ctx.price.rows)).toEqual(['Veroton', 'ALV 25,5 %', 'Loppusumma']);
    expect(ctx.price.rows.at(-1)?.emphasis).toBe(true);
    expect(ctx.ktv).toEqual({
      totalPriceVat: 2510,
      materialsVat: 502,
      settings: { ratePercent: 40, deductibleEur: 150, capEur: 2100 },
      footnoteText: '',
      persons: 1,
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

  it('private customer with discount: list prices before discount, discount on its own row, Loppusumma after', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 2000,
          totalPriceVatBeforeDiscount: 2510,
          totalPriceVat0: 1800,
          vatAmount: 459,
          totalPriceVat: 2259,
        }),
      ),
    );
    expect(labels(ctx.price.rows)).toEqual(['Hinta alv0', 'Alennus 10 %', 'Veroton', 'ALV 25,5 %', 'Loppusumma']);
    expect(ctx.price.rows.map((r) => r.value.replace(/\s/g, ' '))).toEqual([
      '2 000,00 €',
      '−200,00 €',
      '1 800,00 €',
      '459,00 €',
      '2 259,00 €',
    ]);
  });

  it('business customer with discount: alv0 discount amount on its own row', () => {
    const ctx = buildPdfContext(
      input(
        record({ customerType: 'business', reverseVat: true }, {
          discountPercent: 10,
          totalPriceVat0BeforeDiscount: 2000,
          totalPriceVat0: 1800,
        }),
      ),
    );
    expect(labels(ctx.price.rows)).toEqual(['Hinta alv0', 'Alennus 10 %', 'Loppusumma']);
    expect(ctx.price.rows[1].value.replace(/\s/g, ' ')).toBe('−200,00 €');
    expect(ctx.price.rows[2].value.replace(/\s/g, ' ')).toBe('1 800,00 €');
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
    expect(JSON.stringify(ctx.price)).not.toContain('Käänteinen ALV');
    expect(ctx.price.rows[0].value.replace(/\s/g, ' ')).toBe('2 000,00 €');
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
