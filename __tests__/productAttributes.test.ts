import {
  attributeFieldValues,
  canonicalizeProductAttributes,
  parseProductAttributesJson,
  productWorkFactor,
} from '../src/core/product/productAttributes';

describe('productAttributes', () => {
  test('work_factor wins over leftover Finnish tyokerroin', () => {
    const canonical = canonicalizeProductAttributes({
      consumption: 8,
      work_factor: 1,
      tyokerroin: 1.25,
    });
    expect(canonical).toEqual({ consumption: 8, work_factor: 1 });
    expect(productWorkFactor({ work_factor: 1, tyokerroin: 1.25 })).toBe(1);
  });

  test('Finnish tyokerroin is used when work_factor is missing', () => {
    expect(canonicalizeProductAttributes({ tyokerroin: 1.25 })).toEqual({ work_factor: 1.25 });
    expect(attributeFieldValues({ tyokerroin: 1.25 }).workFactor).toBe('1.25');
  });

  test('missing work factor defaults to 1 in formulas', () => {
    expect(productWorkFactor(undefined)).toBe(1);
    expect(productWorkFactor({ consumption: 8 })).toBe(1);
  });

  test('parseProductAttributesJson canonicalizes aliases and numeric strings', () => {
    const parsed = parseProductAttributesJson(
      '{"menekki":"8","tyokerroin":1.25,"work_factor":1}',
    );
    expect(parsed).toEqual({ consumption: 8, work_factor: 1 });
  });

  test('parseProductAttributesJson accepts decimal comma strings', () => {
    const parsed = parseProductAttributesJson('{"tyokerroin":"1,25"}');
    expect(parsed).toEqual({ work_factor: 1.25 });
  });
});
