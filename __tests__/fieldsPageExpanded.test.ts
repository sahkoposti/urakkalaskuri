import {
  UNASSIGNED_FIELDS_SECTION_ID,
  isFieldsPageExpanded,
  parseFieldsPageExpanded,
  toggleFieldsPageExpanded,
} from '../src/core/form/fieldsPageExpanded';

describe('fieldsPageExpanded', () => {
  test('parse empty and invalid as empty map', () => {
    expect(parseFieldsPageExpanded(null)).toEqual({});
    expect(parseFieldsPageExpanded(undefined)).toEqual({});
    expect(parseFieldsPageExpanded('')).toEqual({});
    expect(parseFieldsPageExpanded('not-json')).toEqual({});
    expect(parseFieldsPageExpanded('[]')).toEqual({});
  });

  test('parse keeps only boolean values', () => {
    expect(parseFieldsPageExpanded('{"a":true,"b":false,"c":1}')).toEqual({
      a: true,
      b: false,
    });
  });

  test('missing key is collapsed', () => {
    expect(isFieldsPageExpanded({}, 'page_1')).toBe(false);
    expect(isFieldsPageExpanded({ page_1: false }, 'page_1')).toBe(false);
    expect(isFieldsPageExpanded({ page_1: true }, 'page_1')).toBe(true);
  });

  test('toggle opens then closes', () => {
    const opened = toggleFieldsPageExpanded({}, 'page_1');
    expect(opened.page_1).toBe(true);
    expect(toggleFieldsPageExpanded(opened, 'page_1').page_1).toBe(false);
  });

  test('unassigned section id is stable', () => {
    expect(UNASSIGNED_FIELDS_SECTION_ID).toBe('__unassigned');
  });
});
