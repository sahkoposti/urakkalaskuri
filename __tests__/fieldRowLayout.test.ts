import { groupFieldsIntoRows } from '../src/core/form/fieldRowLayout';
import { createDefaultFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import type { FormField } from '../src/core/form/types';

function field(id: string, patch: Partial<FormField> = {}): FormField {
  return {
    id,
    key: id,
    label: id,
    type: 'number',
    required: false,
    showOnSummary: false,
    ...patch,
  };
}

describe('groupFieldsIntoRows', () => {
  test('keeps a lone field on its own row even if the flag is set', () => {
    expect(groupFieldsIntoRows([field('a', { sameRowAsPrevious: true })])).toEqual([
      [expect.objectContaining({ id: 'a' })],
    ]);
  });

  test('two fields share a row 50/50 when the second continues the previous', () => {
    const rows = groupFieldsIntoRows([
      field('width'),
      field('height', { sameRowAsPrevious: true }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.map((item) => item.id)).toEqual(['width', 'height']);
  });

  test('three consecutive continuations share one row', () => {
    const rows = groupFieldsIntoRows([
      field('a'),
      field('b', { sameRowAsPrevious: true }),
      field('c', { sameRowAsPrevious: true }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  test('a field without the flag starts a new row', () => {
    const rows = groupFieldsIntoRows([
      field('a'),
      field('b', { sameRowAsPrevious: true }),
      field('c'),
      field('d', { sameRowAsPrevious: true }),
    ]);
    expect(rows.map((row) => row.map((item) => item.id))).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  test('section titles always occupy their own row and break a group', () => {
    const rows = groupFieldsIntoRows([
      field('a'),
      field('heading', { type: 'section', sameRowAsPrevious: true }),
      field('b', { sameRowAsPrevious: true }),
    ]);
    expect(rows.map((row) => row.map((item) => item.id))).toEqual([['a'], ['heading'], ['b']]);
  });
});

describe('julkisivumaalaus sameRowAsPrevious', () => {
  test('pairs height, doors, soffit length and paint cost with the previous field', () => {
    const form = normalizeFormDefinition(createDefaultFormDefinition());
    const byKey = Object.fromEntries(form.fields.map((item) => [item.key, item]));

    expect(byKey.kohteen_korkeuskerroin?.sameRowAsPrevious).toBe(true);
    expect(byKey.raystaskorkeus_m?.sameRowAsPrevious).toBe(true);
    expect(byKey.harjakorkeus_m?.sameRowAsPrevious).toBe(true);
    expect(byKey.lisaseinien_keskikorkeus_m?.sameRowAsPrevious).toBe(true);
    expect(byKey.lisaseinien_keskikorkeus_m?.label).toBe('Lisäseinien korkeus');
    expect(byKey.ovet_lkm?.sameRowAsPrevious).toBe(true);
    expect(byKey.raystaanaluset_jm?.sameRowAsPrevious).toBe(true);
    expect(byKey.maalit_alv0?.sameRowAsPrevious).toBe(true);

    expect(byKey.maaston_vaikeusaste?.sameRowAsPrevious).toBeUndefined();
    expect(byKey.raystassivun_pituus_m?.sameRowAsPrevious).toBeUndefined();
  });
});
