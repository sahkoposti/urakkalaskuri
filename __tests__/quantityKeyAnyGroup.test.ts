import { parseImportedFormDefinitionWithWarnings } from '../src/core/form/formDefinitionIo';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { applyPrintEditorChange, readPrintEditorState } from '../src/core/form/printEditorState';
import { normalizePrintSettings } from '../src/core/form/printSettings';
import type { FormDefinition, FormField } from '../src/core/form/types';
import { prefillMaterialQuantities } from '../src/core/materials/materialQuantities';
import type { Product } from '../src/core/models/types';
import { line } from './pdfFixtures';
import { buildPrintedBody } from '../src/core/pdf/printedSection';
import { printableFields } from '../src/core/pdf/printableFields';

const vaha: Product = {
  id: 'vaha',
  name: 'Fiktiivinen vaha',
  unit: 'l',
  unitPriceVat0: 8,
  createdAt: new Date(2026, 0, 1),
};

function field(partial: Partial<FormField> & Pick<FormField, 'id' | 'key' | 'type'>): FormField {
  return { label: partial.label ?? partial.key, required: false, showOnSummary: false, ...partial };
}

function waxForm(group: 'muuta' | 'maali', withKey: boolean): FormDefinition {
  const card: { group: 'muuta' | 'maali'; quantityKey?: string } = { group };
  if (withKey) card.quantityKey = 'vahan_maara';
  return {
    id: 'wax-form',
    name: 'Vahaus',
    version: 1,
    updatedAt: 1,
    pages: [
      { id: 'asiakas', title: 'Asiakas', sortOrder: 0, system: 'customer', fieldIds: [] },
      { id: 'tyo', title: 'Työ', sortOrder: 1, fieldIds: ['wax', 'vq'] },
    ],
    fields: [
      field({
        id: 'wax',
        key: 'vahaus',
        type: 'product_select',
        label: 'Vahaus',
        print: { urakkakortti: card },
      }),
      field({ id: 'vq', key: 'vahan_maara', type: 'number', unit: 'litraa', label: 'Vahan määrä' }),
    ],
  };
}

function cardPrint(form: FormDefinition) {
  const print = form.fields.find((item) => item.key === 'vahaus')?.print?.urakkakortti;
  return print && print !== true ? print : undefined;
}

describe('urakkakortti quantityKey on any product_select group', () => {
  test('normalize keeps a non-maali key (load, save, structure row and migration)', () => {
    const raw = waxForm('muuta', true);
    const stored = JSON.parse(JSON.stringify(raw)) as FormDefinition;
    const normalized = normalizeFormDefinition(stored);
    expect(cardPrint(normalized)).toMatchObject({ group: 'muuta', quantityKey: 'vahan_maara' });
  });

  test('import keeps a non-maali key', () => {
    const imported = parseImportedFormDefinitionWithWarnings(JSON.stringify(waxForm('muuta', true)));
    expect(imported.warnings.filter((item) => item.includes('quantityKey'))).toEqual([]);
    expect(cardPrint(imported.form)).toMatchObject({ group: 'muuta', quantityKey: 'vahan_maara' });
  });

  test('editor keeps a valid key when the group changes away from maali', () => {
    const form = normalizeFormDefinition(waxForm('maali', true));
    const field = form.fields.find((item) => item.key === 'vahaus');
    if (!field) throw new Error('vahaus puuttuu');
    const current = readPrintEditorState(field, form);
    if (!current.urakkakortti) throw new Error('urakkakortti puuttuu');
    const next = applyPrintEditorChange(field, form, {
      ...current,
      legacy: false,
      urakkakortti: { ...current.urakkakortti, group: 'muuta' },
    });
    const card = next.print?.urakkakortti;
    expect(card && card !== true ? card : undefined).toMatchObject({
      group: 'muuta',
      quantityKey: 'vahan_maara',
    });
  });

  test('a normalized non-maali form pre-fills through paintCandidates', () => {
    const form = normalizeFormDefinition(waxForm('muuta', true));
    const [row] = prefillMaterialQuantities(
      {
        ...line('line-wax', 's-wax', 'Vahaus'),
        fieldValues: { vahaus: 'vaha', vahan_maara: '4' },
        snapshot: {
          formId: 'wax-form',
          formVersion: 1,
          fields: [
            { key: 'vahaus', label: 'Vahaus', value: 'Fiktiivinen vaha' },
            { key: 'vahan_maara', label: 'Vahan määrä', value: '4 litraa', unit: 'litraa' },
          ],
        },
      },
      form,
      [vaha],
    );
    expect(row).toMatchObject({
      productName: 'Fiktiivinen vaha',
      quantity: 4,
      unit: 'litraa',
      fieldKey: 'vahaus',
      source: 'form',
    });
  });

  test('maali normalize output and prefill stay the same', () => {
    const paint = field({ id: 'm', key: 'kaytettava_maali', type: 'product_select', label: 'Maali' });
    const litres = field({ id: 'q', key: 'maalit_yhteensa_litraa', type: 'number', unit: 'litraa' });
    const direct = normalizePrintSettings(
      { urakkakortti: { group: 'maali', quantityKey: 'maalit_yhteensa_litraa' } },
      paint,
      { fields: [paint, litres] },
    );
    expect(direct.warnings).toEqual([]);
    expect(direct.print).toEqual({
      urakkakortti: { group: 'maali', quantityKey: 'maalit_yhteensa_litraa' },
    });

    const form = normalizeFormDefinition({
      ...waxForm('maali', true),
      fields: [
        field({
          id: 'wax',
          key: 'vahaus',
          type: 'product_select',
          label: 'Maali',
          print: { urakkakortti: { group: 'maali', quantityKey: 'vahan_maara' } },
        }),
        field({ id: 'vq', key: 'vahan_maara', type: 'number', unit: 'litraa' }),
      ],
    });
    const [row] = prefillMaterialQuantities(
      {
        ...line('line-paint', 's-paint', 'Maalaus'),
        fieldValues: { vahaus: 'vaha', vahan_maara: '49' },
        snapshot: {
          formId: form.id,
          formVersion: 1,
          fields: [{ key: 'vahan_maara', label: 'Litrat', value: '49 litraa', unit: 'litraa' }],
        },
      },
      form,
      [vaha],
    );
    expect(row).toMatchObject({ quantity: 49, unit: 'litraa', productName: 'Fiktiivinen vaha', source: 'form' });
  });

  test('bundled template quantity keys are unchanged', () => {
    function entries(form: FormDefinition): string[] {
      return form.fields
        .flatMap((item) => {
          const card = item.print?.urakkakortti;
          if (!card || card === true || !card.quantityKey) return [];
          return [`${item.key}|${card.group ?? ''}|${card.quantityKey}`];
        })
        .sort();
    }
    const raw = createDefaultFormDefinition();
    expect(entries(normalizeFormDefinition(raw))).toEqual(entries(raw));
  });

  test('urakkakortti print for a non-maali field ignores quantityKey', () => {
    const withKey = normalizeFormDefinition(waxForm('muuta', true));
    const withoutKey = normalizeFormDefinition(waxForm('muuta', false));
    const input = {
      fieldValues: { vahaus: 'vaha', vahan_maara: '4' },
      context: { vahan_maara: 4 },
      products: [vaha],
      target: 'urakkakortti' as const,
    };
    const printedWith = printableFields({ ...input, form: withKey });
    const printedWithout = printableFields({ ...input, form: withoutKey });
    expect(printedWith).toEqual(printedWithout);
    expect(printedWith.some((row) => row.quantity)).toBe(false);
    expect(buildPrintedBody(printedWith)).toEqual(buildPrintedBody(printedWithout));
  });
});
