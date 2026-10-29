import type { FormDefinition, FormField } from '../src/core/form/types';
import type { StructureLine } from '../src/core/models/types';
import { defaultCompanyProfile, parseStoredCompanyProfile } from '../src/core/company/defaultCompany';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { normalizeOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import { escapeMultiline } from '../src/core/pdf/escapeHtml';
import { kotitalousDeduction } from '../src/core/pdf/kotitalousDeduction';
import {
  buildOfferRows,
  buildOfferSections,
  offerVatSummary,
  sellerContactLines,
} from '../src/core/pdf/offerDocument';
import { groupPrintRows, printableFields } from '../src/core/pdf/printableFields';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { lineTotalVat0 } from '../src/core/structure/linePricing';
import { ensureStructureLines } from '../src/core/structure/legacyCalculation';
import { MANUAL_STRUCTURE_ID } from '../src/core/structure/types';
import type { ProductStructure } from '../src/core/structure/types';
import { applyVat } from '../src/core/utils/priceDisplay';
import { customerFromRecord } from '../src/core/models/types';
import { formatCurrency, formatDebugDecimal, formatPercent, roundToCents } from '../src/core/utils/formatters';
import { form, input, line, record, structure } from './pdfFixtures';

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return { label: partial.key, required: false, showOnSummary: false, ...partial };
}

function offerForm(fields: FormField[]): FormDefinition {
  return {
    id: 'offer-form',
    name: 'Tarjoustesti',
    version: 1,
    updatedAt: 1,
    pages: [{ id: 'p1', title: 'Työ', sortOrder: 0, fieldIds: fields.map((item) => item.id) }],
    fields,
  };
}

function withForm(id: string, name: string, definition: FormDefinition): ProductStructure {
  return { ...structure(id, name), form: definition };
}

const areaFields = [
  field({
    id: 'raystaat',
    key: 'raystaat',
    type: 'boolean',
    label: 'Räystäät',
    print: { offer: { group: 'osa_alueet', order: 1, label: 'Räystäät' } },
  }),
  field({
    id: 'otsa',
    key: 'otsalaudat',
    type: 'boolean',
    label: 'Otsalaudat',
    print: { offer: { group: 'osa_alueet', order: 2, label: 'Otsalaudat' } },
  }),
  field({
    id: 'pohja',
    key: 'pohjamaalaus',
    type: 'boolean',
    label: 'Pohjamaalaus',
    print: { offer: { group: 'tyovaiheet', order: 1, label: 'Pohjamaalaus' } },
  }),
  field({
    id: 'valmis',
    key: 'valmiiksi',
    type: 'boolean',
    label: 'Valmiiksimaalaus',
    print: { offer: { group: 'tyovaiheet', order: 2, label: 'Valmiiksimaalaus' } },
  }),
  field({
    id: 'muuta',
    key: 'muuta',
    type: 'text',
    label: 'Muuta',
    print: { offer: { group: 'muuta', order: 1, label: '' } },
  }),
  field({
    id: 'vapaa',
    key: 'vapaa',
    type: 'text',
    label: 'Vapaa',
    print: { offer: { group: 'tieto', order: 1, label: '' } },
  }),
  field({
    id: 'korkeus',
    key: 'korkeus',
    type: 'number',
    label: 'Korkeus',
    unit: 'm',
    print: { offer: { group: 'tieto', order: 2, label: 'Korkeus' } },
  }),
  field({
    id: 'maali',
    key: 'maali',
    type: 'product_select',
    label: 'Maali',
    print: { offer: { group: 'maali', label: 'Maali' } },
  }),
  field({ id: 'piilomaara', key: 'piilomaara', type: 'number', label: 'Määrä', unit: 'l' }),
];

const chimneyFields = [
  field({
    id: 'piippu',
    key: 'piippu',
    type: 'boolean',
    label: 'Piippu',
    print: { offer: { group: 'osa_alueet', label: 'Piippu' } },
  }),
  field({
    id: 'pohjatyo',
    key: 'pohjatyo',
    type: 'boolean',
    label: 'Pohjatyö',
    print: { offer: { group: 'tyovaiheet', label: 'Pohjatyö' } },
  }),
  field({
    id: 'leveys',
    key: 'leveys',
    type: 'text',
    label: 'Leveys',
    print: { offer: { group: 'tieto', label: 'Leveys' } },
  }),
];

function snap(fields: { key: string; label: string; value: string; unit?: string }[]) {
  return { formId: 'offer-form', formVersion: 1, fields };
}

const eaves: StructureLine = {
  ...line('a', 's-a', 'Räystäänalusten maalaus'),
  quantity: 12,
  unit: 'm',
  unitPriceVat0: 80,
  vatPercent: 25.5,
  discountPercent: 0,
  fieldValues: { korkeus: '1', piilomaara: '8,5' },
  overrides: ['workDurationDisplay'],
  displayWorkDurationDays: 4,
  workDurationDays: 1,
  snapshot: snap([
    { key: 'raystaat', label: 'Räystäät', value: 'Kyllä' },
    { key: 'otsalaudat', label: 'Otsalaudat', value: 'Kyllä' },
    { key: 'pohjamaalaus', label: 'Pohjamaalaus', value: 'Kyllä' },
    { key: 'valmiiksi', label: 'Valmiiksimaalaus', value: 'Kyllä' },
    { key: 'muuta', label: '', value: 'Kaksi kerrosta.' },
    { key: 'vapaa', label: '', value: 'Pelkkä arvo <b>' },
    { key: 'korkeus', label: 'Korkeus', value: '99,0 m', unit: 'm' },
    { key: 'maali', label: 'Maali', value: 'Testimaali Sininen' },
  ]),
};

const chimney: StructureLine = {
  ...line('b', 's-b', 'Savupiipun kyljen maalaus'),
  quantity: 3.5,
  unit: 'm²',
  unitPriceVat0: 40,
  vatPercent: 25.5,
  discountPercent: 0,
  overrides: ['workDurationDisplay'],
  displayWorkDurationDays: 2,
  workDurationDays: 1,
  snapshot: snap([
    { key: 'piippu', label: 'Piippu', value: 'Kyllä' },
    { key: 'pohjatyo', label: 'Pohjatyö', value: 'Kyllä' },
    { key: 'leveys', label: 'Leveys', value: '40 cm' },
  ]),
};

const hoist: StructureLine = {
  ...line('m', MANUAL_STRUCTURE_ID, 'Nosturivuokra'),
  quantity: 1,
  unit: 'erä',
  unitPriceVat0: 150,
  vatPercent: 25.5,
  discountPercent: 0,
  additionalInfo: '  Henkilönostin kuvitteelliselle pihalle.  ',
  workDurationDays: 9,
  snapshot: undefined,
  fieldValues: {},
};

const groupedStructures = [
  withForm('s-a', 'Räystäät', offerForm(areaFields)),
  withForm('s-b', 'Piippu', offerForm(chimneyFields)),
];

function groupedInput(lines: StructureLine[], customer: Parameters<typeof record>[0] = {}) {
  return input(
    record(customer, {
      structureLines: lines,
      deliveryScheduleText: 'Viikko 20, kuvitteellinen.',
    }),
    {
      structures: groupedStructures,
      products: [],
      offerStructureSettings: {
        's-a': { additionalInfoText: 'Rivi 1\nRivi <2>', offerPages: [] },
        's-b': { additionalInfoText: 'Nokihormi kuvitteellinen.', offerPages: [] },
      },
    },
  );
}

const money = (vat0: number, vatPercent: number, includesVat: boolean) =>
  formatCurrency(roundToCents(includesVat ? applyVat(vat0, vatPercent) : vat0));

describe('offer rows and sections', () => {
  const source = groupedInput([eaves, chimney, hoist]);

  it('prints structure and manual rows in saved order, with VAT-inclusive prices and no Ale column', () => {
    const rows = buildOfferRows(source);
    expect(rows.map((row) => row.name)).toEqual([
      'Räystäänalusten maalaus',
      'Savupiipun kyljen maalaus',
      'Nosturivuokra',
    ]);
    expect(rows.map((row) => row.quantity)).toEqual([
      formatDebugDecimal(12),
      formatDebugDecimal(3.5),
      formatDebugDecimal(1),
    ]);
    expect(rows.map((row) => row.unit)).toEqual(['m', 'm²', 'erä']);
    expect(rows[0].unitPrice).toBe(money(80, 25.5, true));
    expect(rows[0].total).toBe(money(lineTotalVat0(eaves), 25.5, true));
    expect(rows[0].vatPercent).toBe(formatPercent(25.5));
    expect(rows.every((row) => row.discountPercent === undefined)).toBe(true);
    expect(rows[2].description).toBe('Henkilönostin kuvitteelliselle pihalle.');
    expect(rows[0].description).toBeUndefined();

    const html = renderTarjousHtml(buildPdfContext(source));
    expect(html).toContain('A-hinta (sis. alv)');
    expect(html).toContain('>Nimike</th>');
    expect(html).toContain('>Määrä</th>');
    expect(html).toContain('>Yks.</th>');
    expect(html).toContain('>Alv-%</th>');
    expect(html).toContain('>Yht.</th>');
    expect(html).not.toContain('>Ale %</th>');
    expect(html).toContain('class="offer-desc"');
    expect((html.match(/Toimitusajankohta/g) ?? []).length).toBe(1);
    const deliveryAt = html.indexOf('Toimitusajankohta');
    expect(deliveryAt).toBeGreaterThan(html.indexOf('class="offer-rows"'));
    expect(deliveryAt).toBeLessThan(html.indexOf('class="offer-section"'));
  });

  it('uses alv 0 % prices for a business customer and shows Ale % only when a line has a discount', () => {
    const business = buildOfferRows(groupedInput([eaves, chimney, hoist], { customerType: 'business' }));
    expect(business[0].unitPrice).toBe(money(80, 25.5, false));
    expect(business[0].total).toBe(money(lineTotalVat0(eaves), 25.5, false));
    expect(business.every((row) => row.vatPercent === formatPercent(0))).toBe(true);
    const html = renderTarjousHtml(buildPdfContext(groupedInput([eaves, chimney, hoist], { customerType: 'business', reverseVat: true })));
    expect(html).toContain('A-hinta (alv 0 %)');
    expect(html).not.toContain('A-hinta (sis. alv)');

    const discounted = buildOfferRows(groupedInput([{ ...chimney, discountPercent: 10 }, eaves]));
    expect(discounted.map((row) => row.discountPercent)).toEqual([formatPercent(10), formatPercent(0)]);
    expect(renderTarjousHtml(buildPdfContext(groupedInput([{ ...chimney, discountPercent: 10 }])))).toContain('>Ale %</th>');
  });

  it('gives each structure its own grouped section and leaves the manual row without one', () => {
    const sections = buildOfferSections(source);
    expect(sections.map((section) => section.title)).toEqual([
      'Räystäänalusten maalaus',
      'Savupiipun kyljen maalaus',
    ]);
    expect(sections[0].areas).toBe('Osa-alueet: Räystäät, Otsalaudat');
    expect(sections[0].phases).toEqual(['Pohjamaalaus', 'Valmiiksimaalaus']);
    expect(sections[0].notes).toEqual(['Kaksi kerrosta.', 'Rivi 1\nRivi <2>']);
    expect(sections[0].facts).toEqual(['Pelkkä arvo <b>', 'Korkeus 99,0 m']);
    expect(sections[0].paints).toEqual(['Testimaali Sininen']);
    expect(sections[0].workDuration).toBe('Työn arvioitu kesto 4 työpäivää');
    expect(JSON.stringify(sections)).not.toContain('8,5');
    expect(sections[1]).toMatchObject({
      areas: 'Osa-alueet: Piippu',
      phases: ['Pohjatyö'],
      facts: ['Leveys 40 cm'],
      notes: ['Nokihormi kuvitteellinen.'],
      paints: [],
      workDuration: 'Työn arvioitu kesto 2 työpäivää',
    });

    const html = renderTarjousHtml(buildPdfContext(source));
    expect(html).toContain('Osa-alueet: Räystäät, Otsalaudat');
    expect(html).toContain('<li>Pohjamaalaus</li>');
    expect(html).toContain('Pelkkä arvo &lt;b&gt;');
    expect(html).not.toContain('Pelkkä arvo <b>');
    expect(html).toContain('Rivi 1<br />Rivi &lt;2&gt;');
    expect(html).toContain('Testimaali Sininen');
    expect(html).not.toContain('8,5');
    expect((html.match(/class="offer-section"/g) ?? []).length).toBe(2);
  });

  it('treats a line with no matching structure as a manual row', () => {
    const orphan: StructureLine = {
      ...hoist,
      id: 'o',
      structureId: 'puuttuva-rakenne',
      name: 'Irtonainen rivi',
      additionalInfo: 'Vain kuvaus.',
    };
    const built = groupedInput([orphan]);
    expect(buildOfferSections(built)).toEqual([]);
    expect(buildOfferRows(built)[0].description).toBe('Vain kuvaus.');
  });
});

describe('offer print defaults', () => {
  it('legacy template without print yields the P1 legacy offer rows', () => {
    const legacy = line('l1', 's1', 'Ulkomaalaus');
    const sections = buildOfferSections(input(record({}, { structureLines: [legacy] })));
    const printed = printableFields({
      form,
      fieldValues: legacy.fieldValues,
      context: {},
      products: [],
      snapshot: legacy.snapshot,
      target: 'offer',
    });
    const grouped = groupPrintRows(printed);
    expect(grouped.osa_alueet).toEqual([]);
    expect(grouped.tyovaiheet).toEqual([]);
    expect(grouped.muuta).toEqual([]);
    expect(grouped.maali).toEqual([]);
    expect(grouped.tieto.length).toBeGreaterThan(0);
    expect(sections[0].facts).toEqual(
      grouped.tieto.map((row) => {
        const label = row.label.trim();
        const value = row.value.trim();
        return label ? `${label} ${value}` : value;
      }),
    );
    expect(sections[0].facts.some((fact) => fact.includes('Kiinteä seinäpinta-ala') && fact.includes('120,0'))).toBe(true);
    expect(sections[0].facts.some((fact) => fact.includes('Paneeli'))).toBe(true);
    expect(sections[0].facts.some((fact) => fact.includes('€'))).toBe(false);
  });

  it('print: {} prints no field rows', () => {
    const silentForm: FormDefinition = {
      ...form,
      fields: form.fields.map((item) => ({ ...item, print: {} })),
    };
    const silent = {
      ...line('l1', 's1', 'Hiljainen'),
      workDurationDays: 0,
      displayWorkDurationDays: undefined,
      overrides: [],
    };
    const sections = buildOfferSections(
      input(record({}, { structureLines: [silent] }), {
        structures: [withForm('s1', 'Hiljainen', silentForm)],
        offerStructureSettings: { s1: { additionalInfoText: '  ', offerPages: [] } },
      }),
    );
    expect(sections).toHaveLength(1);
    expect(sections[0].areas).toBeUndefined();
    expect(sections[0].phases).toEqual([]);
    expect(sections[0].notes).toEqual([]);
    expect(sections[0].facts).toEqual([]);
    expect(sections[0].paints).toEqual([]);
    expect(sections[0].workDuration).toBeUndefined();
  });
});

describe('offer discount, VAT summary and KTV', () => {
  const vat = 25.5;
  const materialsVat0 = 248 / (1 + vat / 100);
  const listVat0 = roundToCents(2480 / (1 + vat / 100));
  const paidVat0 = roundToCents(2232 / (1 + vat / 100));
  const priced = (id: string, name: string, unitPriceVat0: number): StructureLine => ({
    ...line(id, 's1', name),
    quantity: 1,
    discountPercent: 0,
    vatPercent: vat,
    unitPriceVat0,
  });

  function moneyRecord(extra: Parameters<typeof record>[1] = {}) {
    return record(
      {},
      {
        discountPercent: 10,
        vatPercent: vat,
        materialsVat0,
        totalPriceVatBeforeDiscount: 2480,
        totalPriceVat: 2232,
        totalPriceVat0BeforeDiscount: listVat0,
        totalPriceVat0: paidVat0,
        vatAmount: roundToCents(2232 - paidVat0),
        structureLines: [priced('p1', 'Osa A', 1000), priced('p2', 'Osa B', listVat0 - 1000)],
        travelTimeHoursOneWay: 2,
        ...extra,
      },
    );
  }

  it('keeps the discount row and does not discount materials; row totals match the record', () => {
    const rec = moneyRecord();
    const lines = ensureStructureLines(rec);
    const rowSum = lines.reduce((sum, item) => sum + lineTotalVat0(item), 0);
    expect(rowSum).toBe(rec.totalPriceVat0BeforeDiscount);
    expect(roundToCents(rowSum * 0.9)).toBe(rec.totalPriceVat0);

    const ctx = buildPdfContext(input(rec));
    const flat = [...ctx.price.left, ...ctx.price.right].map((row) => `${row.label}=${row.value.replace(/\s/g, ' ')}`);
    expect(flat).toContain(`Hinta alv=${formatCurrency(2480).replace(/\s/g, ' ')}`);
    expect(flat).toContain(`Alennus 10 %=${`−${formatCurrency(248)}`.replace(/\s/g, ' ')}`);
    expect(flat).toContain(`Loppusumma=${formatCurrency(2232).replace(/\s/g, ' ')}`);
    expect(ctx.vatSummary).toEqual([
      { vatPercent: vat, net: paidVat0, vat: roundToCents(2232 - paidVat0), gross: 2232 },
    ]);
    expect(ctx.ktv?.materialsVat).toBe(248);
    expect(ctx.ktv?.materialsVat).not.toBe(roundToCents(248 * 0.9));

    const result = kotitalousDeduction({
      totalPriceVat: ctx.ktv!.totalPriceVat,
      materialsVat: ctx.ktv!.materialsVat,
      settings: ctx.ktv!.settings,
    });
    expect(result.workShareVatIncluded).toBe(1984);
    expect(result.materialsShareVatIncluded).toBe(248);
    expect(result.grossDeduction).toBe(793.6);
    expect(result.deductionAmount).toBe(643.6);
    expect(result.estimatedCostAfterDeduction).toBe(1588.4);
    expect(result.capApplied).toBe(false);
    // Matka (kuvitteellinen 100 €) jää työn osuuteen: sitä ei vähennetä materiaalien lisäksi.
    expect(result.workShareVatIncluded).toBe(2232 - 248);
    expect(result.workShareVatIncluded).not.toBe(2232 - 248 - 100);
  });

  it('caps the deduction at 2 100 € when the work share is over 5 625 €', () => {
    const ctx = buildPdfContext(
      input(
        record({}, {
          discountPercent: 0,
          totalPriceVat: 6000,
          totalPriceVatBeforeDiscount: 6000,
          totalPriceVat0: 4780.88,
          totalPriceVat0BeforeDiscount: 4780.88,
          vatAmount: 1219.12,
          materialsVat0: 0,
          vatPercent: vat,
        }),
      ),
    );
    const result = kotitalousDeduction({
      totalPriceVat: ctx.ktv!.totalPriceVat,
      materialsVat: ctx.ktv!.materialsVat,
      settings: ctx.ktv!.settings,
    });
    expect(result.workShareVatIncluded).toBe(6000);
    expect(result.workShareVatIncluded).toBeGreaterThan(5625);
    expect(result.deductionAmount).toBe(2100);
    expect(result.capApplied).toBe(true);
    expect(result.estimatedCostAfterDeduction).toBe(3900);
  });

  it('omits KTV for business and reverse-VAT customers', () => {
    expect(buildPdfContext(input(record({ customerType: 'business' }))).ktv).toBeUndefined();
    expect(buildPdfContext(input(record({ customerType: 'business', reverseVat: true }))).ktv).toBeUndefined();
    expect(buildPdfContext(input(record({ reverseVat: true }))).ktv).toBeUndefined();
    expect(offerVatSummary(record({ customerType: 'business' }), customerFromRecord(record({ customerType: 'business' })))).toEqual(
      [],
    );
  });

  it('splits several VAT rates by line weight and keeps the saved totals', () => {
    const rec = record({}, {
      structureLines: [
        { ...line('a', 's1', 'A'), vatPercent: 25.5, unitPriceVat0: 1000, quantity: 1, discountPercent: 0 },
        { ...line('b', 's1', 'B'), vatPercent: 10, unitPriceVat0: 500, quantity: 1, discountPercent: 0 },
      ],
      totalPriceVat0: 1500,
      vatAmount: 305,
      totalPriceVat: 1805,
      vatPercent: 25.5,
    });
    expect(offerVatSummary(rec, customerFromRecord(rec))).toEqual([
      { vatPercent: 25.5, net: 1000, vat: 255, gross: 1255 },
      { vatPercent: 10, net: 500, vat: 50, gross: 550 },
    ]);
  });
});

describe('company Lisätiedot and seller', () => {
  const companyText = 'Maksuehto 14 päivää.\nTakuu <2 vuotta> & "ok"';

  it('prints Lisätiedot as-is and escapes HTML, and omits an empty section', () => {
    const html = renderTarjousHtml(
      buildPdfContext(
        input(record({}), {
          offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: companyText },
        }),
      ),
    );
    expect(html).toContain(`<h3>Lisätiedot:</h3><div>${escapeMultiline(companyText)}</div>`);
    expect(html).not.toContain('<2 vuotta>');
    expect(html).toContain('&amp;');

    const empty = renderTarjousHtml(
      buildPdfContext(
        input(record({}), {
          offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: ' \n ' },
        }),
      ),
    );
    expect(empty).not.toContain('Lisätiedot:');
  });

  it('prefers the seller phone and email, falls back to the company, and omits an empty block', () => {
    const own = {
      ...defaultCompanyProfile,
      sellerName: 'Aada Asentaja',
      sellerPhone: '040 111 2233',
      sellerEmail: 'aada@example.test',
      phone: '040 000 0000',
      email: 'toimisto@example.test',
    };
    expect(sellerContactLines(own)).toEqual(['Aada Asentaja', 'Puh. 040 111 2233', 'aada@example.test']);
    expect(sellerContactLines({ ...own, sellerPhone: '', sellerEmail: '  ' })).toEqual([
      'Aada Asentaja',
      'Puh. 040 000 0000',
      'toimisto@example.test',
    ]);
    const blank = {
      ...defaultCompanyProfile,
      sellerName: '',
      sellerPhone: '',
      sellerEmail: '',
      phone: '',
      email: '',
    };
    expect(sellerContactLines(blank)).toEqual([]);
    const html = renderTarjousHtml(buildPdfContext(input(record({}), { company: blank })));
    expect(html).not.toContain('class="offer-seller"');
    expect(html).not.toContain('Myyjä:');
  });

  it('accepts old JSON without the new keys', () => {
    expect(normalizeOfferCompanySettings(JSON.parse('{"offerValidDays":14}')).additionalInfoText).toBe('');
    expect(normalizeOfferCompanySettings({ additionalInfoText: 5 }).additionalInfoText).toBe('');
    const parsed = parseStoredCompanyProfile('{"companyName":"Kuvitteellinen Oy"}');
    expect(parsed.companyName).toBe('Kuvitteellinen Oy');
    expect(parsed.sellerPhone).toBe('');
    expect(parsed.sellerEmail).toBe('');
    expect(parsed.phone).toBe(defaultCompanyProfile.phone);
  });
});

describe('renderTarjousHtml offer order', () => {
  it('orders table, sections, totals, Lisätiedot, seller and the KTV page last', () => {
    const html = renderTarjousHtml(
      buildPdfContext(
        input(record({}), {
          offerCompany: { ...defaultOfferCompanySettings, additionalInfoText: 'Maksuehto.' },
        }),
      ),
    );
    const at = (needle: string) => html.indexOf(needle);
    expect(at('class="offer-rows"')).toBeGreaterThan(-1);
    expect(at('class="offer-section"')).toBeGreaterThan(at('class="offer-rows"'));
    expect(at('class="price-block"')).toBeGreaterThan(at('class="offer-section"'));
    expect(at('class="offer-vat"')).toBeGreaterThan(at('class="price-block"'));
    expect(at('Lisätiedot:')).toBeGreaterThan(at('class="offer-vat"'));
    expect(at('class="offer-seller"')).toBeGreaterThan(at('Lisätiedot:'));
    expect(at('class="ktv-page')).toBeGreaterThan(at('class="offer-seller"'));
    const forbidden = ['k', 'hv'].join('');
    expect(html.toLowerCase()).not.toContain(forbidden);
  });
});
