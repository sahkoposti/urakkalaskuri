import type { FormDefinition, FormField } from '../src/core/form/types';
import type { CalculationRecord, FormSnapshot, Product, StructureLine } from '../src/core/models/types';
import { customerFromRecord } from '../src/core/models/types';
import { buildOfferSections } from '../src/core/pdf/offerDocument';
import { lineSpecSnapshot, specCardsFromSnapshot, type SpecCard } from '../src/core/pdf/offerPageSpecs';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { specGridLayout } from '../src/core/pdf/specGridLayout';
import {
  buildUrakkakorttiContext,
  urakkakorttiSpecCards,
  type BuildUrakkakorttiInput,
} from '../src/core/pdf/urakkakortti';
import { lineUsesUrakkakorttiPrint } from '../src/core/pdf/urakkakorttiSections';
import { recordWithManualContractPrices } from '../src/core/pdf/manualContract';
import { ensureStructureLines } from '../src/core/structure/legacyCalculation';
import { MANUAL_STRUCTURE_ID, type ProductStructure } from '../src/core/structure/types';
import { formatCurrency } from '../src/core/utils/formatters';
import { form, input, line, record, structure } from './pdfFixtures';

/**
 * T9-speksikortit sellaisenaan (ennen P4:n print-suodatusta).
 * Vertailu todistaa, että vanha pohja tuottaa saman HTML:n.
 */
function t9UrakkakorttiSpecCards(source: BuildUrakkakorttiInput): SpecCard[] {
  const customer = customerFromRecord(source.record);
  const lines = ensureStructureLines(source.record);
  const perLine = lines.map((item) => {
    const found = source.structures.find((entry) => entry.id === item.structureId);
    const customerPageIds = new Set(
      (found?.form.pages ?? []).filter((page) => page.system === 'customer').map((page) => page.id),
    );
    const snapshot = lineSpecSnapshot(
      item,
      found,
      source.products,
      source.settings,
      Boolean(customer.reverseVat),
      source.record.travelTimeHoursOneWay,
    );
    const cards = specCardsFromSnapshot(snapshot, found?.form)
      .filter((card) => card.pageId == null || !customerPageIds.has(card.pageId))
      .map((card) => ({ ...card, rows: card.rows.filter((row) => !row.value.includes('€')) }))
      .filter((card) => card.rows.length > 0);
    return { item, cards };
  });
  const many = perLine.filter((entry) => entry.cards.length > 0).length > 1;
  return perLine.flatMap(({ item, cards }) =>
    many ? cards.map((card) => ({ ...card, title: `${item.name}: ${card.title}` })) : cards,
  );
}

function ukInput(rec: CalculationRecord, overrides: Partial<BuildUrakkakorttiInput> = {}): BuildUrakkakorttiInput {
  const base = input(rec);
  return {
    record: rec,
    company: base.company,
    structures: base.structures,
    products: base.products,
    settings: base.settings,
    generatedAt: new Date(2026, 9, 10),
    ...overrides,
  };
}

function frozenHtml(source: BuildUrakkakorttiInput): string {
  const ctx = buildUrakkakorttiContext(source);
  return renderUrakkakorttiHtml({
    ...ctx,
    sections: [],
    specGrid: specGridLayout(t9UrakkakorttiSpecCards(source)),
  });
}

const bodyOf = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/, '');

const STORED_SINGLE_LINE_CARD =
  '<div class="spec-card full"><h2>Pinta-alat</h2><table><tr><td>Kiinteä seinäpinta-ala</td><td class="value">120,0 m²</td></tr><tr><td>Aukkovähennykset</td><td class="value">–</td></tr><tr><td>Laudoitustyyppi</td><td class="value">Paneeli</td></tr><tr><td>Seinäpinta-ala (laskettu)</td><td class="value">–</td></tr></table></div>';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return { label: partial.key, required: false, showOnSummary: false, ...partial };
}

function printForm(fields: FormField[]): FormDefinition {
  return {
    id: 'print-form',
    name: 'Tulostustesti',
    version: 1,
    updatedAt: 1,
    pages: [{ id: 'tyo', title: 'Työ', sortOrder: 0, fieldIds: fields.map((item) => item.id) }],
    fields,
  };
}

function snap(fields: FormSnapshot['fields']): FormSnapshot {
  return { formId: 'print-form', formVersion: 1, fields };
}

const paint: Product = {
  id: 'maali-1',
  name: 'Testimaali Sininen',
  unit: 'l',
  unitPriceVat0: 10,
  structureIds: ['s-print'],
  createdAt: new Date(2026, 0, 1),
};

const primer: Product = {
  id: 'maali-2',
  name: 'Pohjuste Harmaa',
  unit: 'l',
  unitPriceVat0: 8,
  structureIds: ['s-print'],
  createdAt: new Date(2026, 0, 1),
};

const templateFields: FormField[] = [
  field({
    id: 'julkisivu',
    key: 'julkisivupinnat_valinta',
    type: 'boolean',
    label: 'Julkisivupinnat',
    print: { urakkakortti: { group: 'osa_alueet', order: 2, label: 'Julkisivupinnat' } },
  }),
  field({
    id: 'sokkeli',
    key: 'sokkelipinnat_valinta',
    type: 'boolean',
    label: 'Sokkeli',
    print: { urakkakortti: { group: 'osa_alueet', order: 1, label: 'Sokkeli' } },
  }),
  field({
    id: 'poisto',
    key: 'maalinpoisto_valinta',
    type: 'boolean',
    label: 'Maalinpoisto',
    print: { when: 'ifYes', urakkakortti: { group: 'tyovaiheet', order: 2, label: 'Maalinpoisto' } },
  }),
  field({
    id: 'pohja',
    key: 'pohjamaalaus_valinta',
    type: 'boolean',
    label: 'Pohjamaalaus',
    print: { urakkakortti: { group: 'tyovaiheet', order: 1, when: 'ifYes', label: 'Pohjamaalaus' } },
  }),
  field({
    id: 'vari',
    key: 'varinvaihto_valinta',
    type: 'boolean',
    label: 'Värinvaihto',
    print: { urakkakortti: { group: 'tieto', order: 1, when: 'always', label: 'Värinvaihto' } },
  }),
  field({
    id: 'ikkunat',
    key: 'ikkunat_lkm',
    type: 'number',
    label: 'Ikkunat',
    unit: 'kpl',
    print: { urakkakortti: { group: 'tieto', order: 1, label: 'Ikkunat' } },
  }),
  field({
    id: 'vapaa',
    key: 'vapaa_arvo',
    type: 'text',
    label: 'Vapaa',
    print: { urakkakortti: { group: 'tieto', order: 2, label: '' } },
  }),
  field({
    id: 'kortti',
    key: 'vain_kortilla',
    type: 'text',
    label: 'Korttirivi',
    print: { urakkakortti: { group: 'tieto', order: 3, label: 'Korttirivi' } },
  }),
  field({
    id: 'muuta',
    key: 'muuta',
    type: 'text',
    label: 'Muuta',
    print: { urakkakortti: { group: 'muuta', label: '' } },
  }),
  field({
    id: 'maali',
    key: 'kaytettava_maali',
    type: 'product_select',
    label: 'Käytettävä maali',
    print: { urakkakortti: { group: 'maali', label: 'Maali', quantityKey: 'ikkunat_lkm' } },
  }),
  field({
    id: 'pohjamaali',
    key: 'pohjamaali',
    type: 'product_select',
    label: 'Pohjamaali',
    print: { urakkakortti: { group: 'maali', label: 'Pohjamaali' } },
  }),
  field({
    id: 'tarjous',
    key: 'vain_tarjouksessa',
    type: 'text',
    label: 'Tarjousrivi',
    print: { offer: { group: 'tieto', label: 'Tarjousrivi' } },
  }),
  field({
    id: 'tyhja',
    key: 'ei_tulostu',
    type: 'text',
    label: 'Ei tulostu',
    showOnSummary: true,
    print: {},
  }),
  field({
    id: 'piilo',
    key: 'piilo_teksti',
    type: 'text',
    label: 'Piilotettu',
    showWhen: { fieldKey: 'kaytossa', operator: 'eq', value: 'true' },
    print: { urakkakortti: { group: 'tieto', label: 'Piilotettu' } },
  }),
  field({ id: 'kaytossa', key: 'kaytossa', type: 'boolean', label: 'Käytössä' }),
  field({
    id: 'euro',
    key: 'euro_yksikko',
    type: 'number',
    label: 'Urakkasumma',
    unit: '€',
    print: { urakkakortti: { group: 'tieto', label: 'Urakkasumma' } },
  }),
  field({
    id: 'euroteksti',
    key: 'euro_teksti',
    type: 'text',
    label: 'Huomio',
    print: { urakkakortti: { group: 'tieto', label: 'Huomio' } },
  }),
];

const template = printForm(templateFields);

const printValues: Record<string, string> = {
  julkisivupinnat_valinta: 'true',
  sokkelipinnat_valinta: 'true',
  maalinpoisto_valinta: 'true',
  pohjamaalaus_valinta: 'true',
  varinvaihto_valinta: 'false',
  muuta: 'elävä teksti',
  vapaa_arvo: 'elävä',
  ikkunat_lkm: '4',
  kaytettava_maali: 'maali-1',
  pohjamaali: 'maali-2',
  vain_tarjouksessa: 'Vain tarjouksessa',
  vain_kortilla: 'Vain kortilla',
  ei_tulostu: 'Ei tulostu mihinkään',
  piilo_teksti: 'Piilossa oleva teksti',
  kaytossa: 'false',
  euro_yksikko: '99',
  euro_teksti: 'sisältää 10 €',
};

const printSnapshot = snap([
  { key: 'julkisivupinnat_valinta', label: 'Julkisivupinnat', value: 'Kyllä' },
  { key: 'sokkelipinnat_valinta', label: 'Sokkeli', value: 'Kyllä' },
  { key: 'maalinpoisto_valinta', label: 'Maalinpoisto', value: 'Kyllä' },
  { key: 'pohjamaalaus_valinta', label: 'Pohjamaalaus', value: 'Kyllä' },
  { key: 'varinvaihto_valinta', label: 'Värinvaihto', value: 'Ei' },
  { key: 'muuta', label: '', value: 'Aita <portti>\n& "koira"' },
  { key: 'vapaa_arvo', label: '', value: 'Pelkkä arvo' },
  { key: 'ikkunat_lkm', label: 'Ikkunat', value: '4', unit: 'kpl' },
  { key: 'kaytettava_maali', label: 'Maali', value: 'Testimaali Sininen' },
  { key: 'pohjamaali', label: 'Pohjamaali', value: 'Pohjuste Harmaa' },
  { key: 'vain_tarjouksessa', label: 'Tarjousrivi', value: 'Vain tarjouksessa' },
  { key: 'vain_kortilla', label: 'Korttirivi', value: 'Vain kortilla' },
  { key: 'ei_tulostu', label: 'Ei tulostu', value: 'Ei tulostu mihinkään' },
  { key: 'piilo_teksti', label: 'Piilotettu', value: 'Piilossa oleva teksti' },
  { key: 'euro_yksikko', label: 'Urakkasumma', value: '99,00 €', unit: '€' },
  { key: 'euro_teksti', label: 'Huomio', value: 'sisältää 10 €' },
]);

function printStructure(): ProductStructure {
  return { ...structure('s-print', 'Sokkelimaalaus'), form: template };
}

function printLine(partial: Partial<StructureLine> = {}): StructureLine {
  return {
    ...line('pr', 's-print', 'Sokkelimaalaus'),
    fieldValues: printValues,
    snapshot: printSnapshot,
    ...partial,
  };
}

function printInput(rec: CalculationRecord, extraStructures: ProductStructure[] = []): BuildUrakkakorttiInput {
  const base = ukInput(rec);
  return {
    ...base,
    structures: [...base.structures, printStructure(), ...extraStructures],
    products: [paint, primer],
  };
}

describe('urakkakortti legacy equivalence', () => {
  it('single-line fixture HTML matches the frozen T9 cards and the stored snapshot fragment', () => {
    const source = ukInput(record({ notes: 'Koira pihalla' }));
    const ctx = buildUrakkakorttiContext(source);
    const html = renderUrakkakorttiHtml(ctx);
    expect(ctx.sections).toEqual([]);
    expect(urakkakorttiSpecCards(source)).toEqual(t9UrakkakorttiSpecCards(source));
    expect(html).toBe(frozenHtml(source));
    expect(html).toContain(STORED_SINGLE_LINE_CARD);
    expect(html).not.toContain('uk-section');
  });

  it('multi-line fixture HTML matches the frozen T9 cards, including the name prefix', () => {
    const lines = [line('a', 's1', 'Ulkomaalaus'), { ...line('b', 's2', 'Sokkeli', '30'), contractPriceVat0: 450 }];
    const source = ukInput(record({}, { structureLines: lines }));
    const ctx = buildUrakkakorttiContext(source);
    expect(ctx.sections).toEqual([]);
    expect(ctx.specGrid.cards.map((card) => card.title)).toEqual(['Ulkomaalaus: Pinta-alat', 'Sokkeli: Pinta-alat']);
    expect(renderUrakkakorttiHtml(ctx)).toBe(frozenHtml(source));
  });

  it('a customer-page field stays off the card, matching the frozen T9 cards', () => {
    const baseLine = line('l1', 's1', 'Ulkomaalaus');
    const customerForm: FormDefinition = {
      ...form,
      pages: [
        {
          id: 'page_customer',
          title: 'Asiakas',
          sortOrder: -1,
          system: 'customer',
          fieldIds: ['field_asiakas_huom'],
        },
        ...form.pages,
      ],
      fields: [
        ...form.fields,
        {
          id: 'field_asiakas_huom',
          key: 'asiakas_huom',
          label: 'Asiakkaan huomautus',
          type: 'text',
          required: false,
          showOnSummary: true,
        },
      ],
    };
    const source = ukInput(
      record(
        {},
        {
          structureLines: [
            {
              ...baseLine,
              snapshot: {
                ...baseLine.snapshot!,
                fields: [
                  ...(baseLine.snapshot?.fields ?? []),
                  {
                    key: 'asiakas_huom',
                    label: 'Asiakkaan huomautus',
                    value: 'Piha-avain testissä',
                    pageTitle: 'Asiakas',
                  },
                ],
              },
            },
          ],
        },
      ),
      { structures: [{ ...structure('s1', 'Ulkomaalaus'), form: customerForm }, structure('s2', 'Sokkeli')] },
    );
    const html = renderUrakkakorttiHtml(buildUrakkakorttiContext(source));
    expect(html).toBe(frozenHtml(source));
    expect(html).toContain('Pinta-alat');
    expect(html).not.toContain('Piha-avain testissä');
    expect(html).not.toContain('Asiakkaan huomautus');
    expect(html).not.toContain('uk-section');
  });
});

describe('urakkakortti print resolver', () => {
  it('groups, order, empty label, always/ifYes, quantity and snapshot value', () => {
    const source = printInput(record({}, { structureLines: [printLine()] }));
    const ctx = buildUrakkakorttiContext(source);
    expect(ctx.specGrid.mode).toBe('none');
    expect(ctx.sections).toHaveLength(1);
    const section = ctx.sections[0];
    expect(section.title).toBe('Sokkelimaalaus');
    expect(section.areas).toBe('Osa-alueet: Sokkeli, Julkisivupinnat');
    expect(section.phases).toEqual(['Pohjamaalaus', 'Maalinpoisto']);
    expect(section.notes).toEqual(['Aita <portti>\n& "koira"']);
    expect(section.facts).toEqual([
      'Värinvaihto Ei',
      'Ikkunat 4 kpl',
      'Pelkkä arvo',
      'Korttirivi Vain kortilla',
    ]);
    expect(section.paints).toEqual(['Testimaali Sininen 4 kpl', 'Pohjuste Harmaa']);
    expect(section.notes[0]).not.toContain('elävä teksti');

    const html = renderUrakkakorttiHtml(ctx);
    expect(html).toContain(
      '<p class="uk-section-areas">Osa-alueet: Sokkeli, Julkisivupinnat</p>',
    );
    expect(html).toContain(
      '<div class="uk-section-phases"><p>Työvaiheet:</p><ul><li>Pohjamaalaus</li><li>Maalinpoisto</li></ul></div>',
    );
    expect(html).toContain(
      '<div class="uk-section-notes"><p>Muuta:</p><p>Aita &lt;portti&gt;<br />&amp; &quot;koira&quot;</p></div>',
    );
    expect(html).toContain('<p class="uk-section-fact">Pelkkä arvo</p>');
    expect(html).toContain('<p class="uk-section-paint">Testimaali Sininen 4 kpl</p>');
    expect(html).toContain('<p class="uk-section-paint">Pohjuste Harmaa</p>');
    expect(html).toContain('break-inside: avoid');
    expect(html).not.toContain('Ei tulostu mihinkään');
    expect(html).not.toContain('Vain tarjouksessa');
    expect(html).not.toContain('Piilossa oleva teksti');
    expect(html).not.toContain('99,00');
    expect(html).not.toContain('sisältää 10');
    expect(html).not.toContain('class="spec-grid"');
  });

  it('ifYes omits Maalinpoisto when the value is Ei; always still prints Värinvaihto Ei', () => {
    const hiddenRemoval = printLine({
      fieldValues: { ...printValues, maalinpoisto_valinta: 'false' },
      snapshot: snap(
        printSnapshot.fields.map((item) =>
          item.key === 'maalinpoisto_valinta' ? { ...item, value: 'Ei' } : item,
        ),
      ),
    });
    const ctx = buildUrakkakorttiContext(printInput(record({}, { structureLines: [hiddenRemoval] })));
    expect(ctx.sections[0].phases).toEqual(['Pohjamaalaus']);
    expect(ctx.sections[0].facts).toContain('Värinvaihto Ei');
    expect(renderUrakkakorttiHtml(ctx)).not.toContain('Maalinpoisto');
  });

  it('print: {} prints nothing and an empty group is omitted', () => {
    const onlyEmpty = printForm([
      field({
        id: 'tyhja',
        key: 'ei_tulostu',
        type: 'text',
        label: 'Ei tulostu',
        showOnSummary: true,
        print: {},
      }),
      field({
        id: 'ikkunat',
        key: 'ikkunat_lkm',
        type: 'number',
        label: 'Ikkunat',
        unit: 'kpl',
        print: { urakkakortti: true },
      }),
    ]);
    const item = printLine({
      fieldValues: { ei_tulostu: 'Ei tulostu mihinkään', ikkunat_lkm: '4' },
      snapshot: snap([
        { key: 'ei_tulostu', label: 'Ei tulostu', value: 'Ei tulostu mihinkään' },
        { key: 'ikkunat_lkm', label: 'Ikkunat', value: '4', unit: 'kpl' },
      ]),
    });
    const source = printInput(record({}, { structureLines: [item] }));
    source.structures = source.structures.map((entry) =>
      entry.id === 's-print' ? { ...entry, form: onlyEmpty } : entry,
    );
    const ctx = buildUrakkakorttiContext(source);
    expect(ctx.specGrid.mode).toBe('none');
    expect(ctx.sections[0].facts).toEqual(['Ikkunat 4 kpl']);
    expect(ctx.sections[0].areas).toBeUndefined();
    expect(ctx.sections[0].phases).toEqual([]);
    expect(ctx.sections[0].notes).toEqual([]);
    expect(ctx.sections[0].paints).toEqual([]);
    const html = renderUrakkakorttiHtml(ctx);
    expect(html).not.toContain('Ei tulostu mihinkään');
    expect(html).not.toContain('Osa-alueet:');
    expect(html).not.toContain('Työvaiheet:');
    expect(html).not.toContain('Muuta:');
    expect(html).not.toContain('uk-section-paint');
  });

  it('prints a urakkakortti-only field and leaves the offer-only field to the offer', () => {
    const rec = record({}, { structureLines: [printLine()] });
    const source = printInput(rec);
    const html = bodyOf(renderUrakkakorttiHtml(buildUrakkakorttiContext(source)));
    expect(html).toContain('Vain kortilla');
    expect(html).not.toContain('Vain tarjouksessa');

    const offer = buildOfferSections({
      record: rec,
      structures: [printStructure()],
      products: [paint, primer],
      settings: source.settings,
      offerStructureSettings: {},
    });
    expect(offer).toHaveLength(1);
    expect(offer[0].facts).toEqual(['Tarjousrivi Vain tarjouksessa']);
    expect(offer[0].phases).toEqual([]);
    expect(offer[0].paints).toEqual([]);
    expect(JSON.stringify(offer[0])).not.toContain('Vain kortilla');
  });

  it('does not print a wizard-hidden field until its showWhen passes', () => {
    const hidden = buildUrakkakorttiContext(printInput(record({}, { structureLines: [printLine()] })));
    expect(renderUrakkakorttiHtml(hidden)).not.toContain('Piilossa oleva teksti');

    const shown = printLine({
      fieldValues: { ...printValues, kaytossa: 'true' },
    });
    const ctx = buildUrakkakorttiContext(printInput(record({}, { structureLines: [shown] })));
    expect(ctx.sections[0].facts).toContain('Piilotettu Piilossa oleva teksti');
  });

  it('drops a print.urakkakortti row whose unit is € or whose value contains €', () => {
    const ctx = buildUrakkakorttiContext(printInput(record({}, { structureLines: [printLine()] })));
    const html = bodyOf(renderUrakkakorttiHtml(ctx));
    expect(html).not.toContain('Urakkasumma');
    expect(html).not.toContain('99,00');
    expect(html).not.toContain('sisältää 10');
    const euroLines = html.split('\n').filter((row) => row.includes('€'));
    expect(euroLines.every((row) => row.includes('Tekijöiden urakka'))).toBe(true);
    expect((html.match(/€/g) ?? []).length).toBe(1);
  });

  it('keeps the forbidden-string check in print mode', () => {
    const rec = record({ notes: 'Huom' }, {
      offerNumber: 10285,
      discountPercent: 10,
      lines: [{ id: 'm1', productName: 'Maali', unit: 'l', unitPriceVat0: 12.34, quantity: 2, lineTotalVat0: 24.68 }],
      structureLines: [printLine()],
    });
    for (const customer of [{}, { customerType: 'business' as const, reverseVat: true }]) {
      const html = bodyOf(
        renderUrakkakorttiHtml(
          buildUrakkakorttiContext(printInput({ ...rec, customer: record(customer).customer })),
        ),
      );
      expect(html).not.toMatch(/ALV|Kate|Palkkio|Loppusumma|Hinta|Ale %|Kotitalous|Voimassa|Tarjousnumero|10285|Lisätiedot:/);
      expect(html).not.toMatch(/2\s510|2\s000,00|333,33|77,77|502,00/);
      const euroLines = html.split('\n').filter((row) => row.includes('€'));
      expect(euroLines.every((row) => row.includes('Tekijöiden urakka'))).toBe(true);
      expect((html.match(/€/g) ?? []).length).toBe(1);
    }
  });

  it('keeps contract rows, info rows, notes and materials in print mode', () => {
    const materials = [
      { id: 'm1', productName: 'Maali X', unit: 'l', unitPriceVat0: 12.34, quantity: 18.5, lineTotalVat0: 228.29 },
    ];
    const legacy = buildUrakkakorttiContext(
      ukInput(record({ notes: 'Koira pihalla' }, { lines: materials, deliveryScheduleText: 'Viikko 40' })),
    );
    const printed = buildUrakkakorttiContext(
      printInput(
        record({ notes: 'Koira pihalla' }, {
          lines: materials,
          deliveryScheduleText: 'Viikko 40',
          structureLines: [printLine()],
        }),
      ),
    );
    expect(printed.contractRows).toEqual(legacy.contractRows);
    expect(printed.infoRows).toEqual(legacy.infoRows);
    expect(printed.customerNotes).toBe(legacy.customerNotes);
    expect(printed.materials).toEqual(legacy.materials);
    expect(printed.offerInfo).toEqual(legacy.offerInfo);

    const manualLegacy = recordWithManualContractPrices(
      record({}, { structureLines: [{ ...line('a', 's1', 'A'), contractPriceVat0: 0 }] }),
      { a: 1234.567 },
    );
    const manualPrint = recordWithManualContractPrices(
      record({}, { structureLines: [printLine({ id: 'a', name: 'A', contractPriceVat0: 0 })] }),
      { a: 1234.567 },
    );
    expect(buildUrakkakorttiContext(printInput(manualPrint)).contractRows).toEqual(
      buildUrakkakorttiContext(ukInput(manualLegacy)).contractRows,
    );
    expect(buildUrakkakorttiContext(printInput(manualPrint)).contractRows[0].value).toBe(formatCurrency(1234.57));

    const multiLegacy = record(
      {},
      {
        structureLines: [line('a', 's1', 'Ulkomaalaus'), { ...line('b', 's2', 'Sokkeli'), contractPriceVat0: 450 }],
      },
    );
    const multiPrint = record(
      {},
      {
        structureLines: [
          printLine({ id: 'a', name: 'Ulkomaalaus' }),
          printLine({ id: 'b', name: 'Sokkeli', contractPriceVat0: 450 }),
        ],
      },
    );
    const legacyCtx = buildUrakkakorttiContext(ukInput(multiLegacy));
    const printCtx = buildUrakkakorttiContext(printInput(multiPrint));
    expect(printCtx.contractRows).toEqual(legacyCtx.contractRows);
    expect(printCtx.infoRows).toEqual(legacyCtx.infoRows);
    expect(printCtx.contractRows.map((row) => row.label)).toEqual([
      'Tekijöiden urakka: Ulkomaalaus',
      'Tekijöiden urakka: Sokkeli',
      'Tekijöiden urakka yhteensä (alv0)',
    ]);
    expect(printCtx.contractRows[2].value.replace(/\s/g, ' ')).toBe('1 450,00 €');

    const printedHtml = bodyOf(renderUrakkakorttiHtml(printed));
    expect(printedHtml).toContain('<td>Maali X</td><td class="value">18,5</td><td>l</td>');
    expect(printedHtml).toContain('Koira pihalla');
    expect(printedHtml).toContain('Viikko 40');
    expect(printedHtml).not.toMatch(/12,34|228,29/);

    const manualMulti = recordWithManualContractPrices(
      record({}, {
        structureLines: [
          printLine({ id: 'a', name: 'Ulkomaalaus', contractPriceVat0: 0 }),
          printLine({ id: 'b', name: 'Sokkeli', contractPriceVat0: 450 }),
        ],
      }),
      { a: 700 },
    );
    const manualCtx = buildUrakkakorttiContext(printInput(manualMulti));
    expect(manualCtx.contractRows.map((row) => row.value)).toEqual([
      formatCurrency(700),
      formatCurrency(450),
      formatCurrency(1150),
    ]);
    expect(bodyOf(renderUrakkakorttiHtml(manualCtx))).not.toContain('Materiaalit');
  });

  it('a field without print still follows the resolver legacy default inside a print-mode line', () => {
    const mixedFields = printForm([
      field({
        id: 'uusi',
        key: 'uusi_valinta',
        type: 'text',
        label: 'Uusi',
        print: { urakkakortti: { group: 'tieto', label: 'Uusi' } },
      }),
      field({
        id: 'vanha',
        key: 'vanha_yhteenveto',
        type: 'text',
        label: 'Vanha yhteenveto',
        showOnSummary: true,
      }),
    ]);
    const item = printLine({
      fieldValues: { uusi_valinta: 'Osio', vanha_yhteenveto: 'Näkyy silti' },
      snapshot: snap([
        { key: 'uusi_valinta', label: 'Uusi', value: 'Osio' },
        { key: 'vanha_yhteenveto', label: 'Vanha yhteenveto', value: 'Näkyy silti' },
      ]),
    });
    const source = printInput(record({}, { structureLines: [item] }));
    source.structures = source.structures.map((entry) =>
      entry.id === 's-print' ? { ...entry, form: mixedFields } : entry,
    );
    const ctx = buildUrakkakorttiContext(source);
    expect(ctx.specGrid.mode).toBe('none');
    expect(ctx.sections[0].facts).toEqual(['Uusi Osio', 'Vanha yhteenveto Näkyy silti']);
  });

  it('mixed calculation prints the legacy spec grid before print sections', () => {
    const legacyLine = line('leg', 's1', 'Ulkomaalaus');
    const rec = record({}, { structureLines: [printLine(), legacyLine] });
    const ctx = buildUrakkakorttiContext(printInput(rec));
    expect(ctx.specGrid.cards.map((card) => card.title)).toEqual(['Pinta-alat']);
    expect(ctx.sections.map((section) => section.title)).toEqual(['Sokkelimaalaus']);
    const html = renderUrakkakorttiHtml(ctx);
    const gridAt = html.indexOf('class="spec-grid"');
    const sectionAt = html.indexOf('class="uk-section"');
    expect(gridAt).toBeGreaterThan(-1);
    expect(sectionAt).toBeGreaterThan(gridAt);

    const twoLegacy = record({}, {
      structureLines: [
        line('a', 's1', 'Ulkomaalaus'),
        { ...line('b', 's2', 'Sokkeli', '30'), contractPriceVat0: 450 },
        printLine({ id: 'c', name: 'Sokkelimaalaus' }),
      ],
    });
    const mixed = buildUrakkakorttiContext(printInput(twoLegacy));
    expect(mixed.specGrid.cards.map((card) => card.title)).toEqual([
      'Ulkomaalaus: Pinta-alat',
      'Sokkeli: Pinta-alat',
    ]);
    expect(mixed.sections.map((section) => section.title)).toEqual(['Sokkelimaalaus']);
    const mixedHtml = renderUrakkakorttiHtml(mixed);
    expect(mixedHtml.indexOf('class="uk-section"')).toBeGreaterThan(mixedHtml.indexOf('class="spec-grid"'));
  });

  it('a manual line stays on the legacy path even if some other structure declares print', () => {
    const manual = printLine({ id: 'm', structureId: MANUAL_STRUCTURE_ID, name: 'Nosturivuokra' });
    expect(lineUsesUrakkakorttiPrint(manual, [printStructure()])).toBe(false);
    expect(lineUsesUrakkakorttiPrint(printLine(), [printStructure()])).toBe(true);
    expect(lineUsesUrakkakorttiPrint(line('a', 's1', 'Ulkomaalaus'), [printStructure(), structure('s1', 'Ulkomaalaus')])).toBe(
      false,
    );
  });
});
