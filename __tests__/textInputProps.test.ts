import fs from 'fs';
import path from 'path';

import {
  NAME_FIELD_KIND,
  textInputPropsFor,
  type TextInputKind,
} from '../src/components/textInputProps';

const KINDS: TextInputKind[] = [
  'email',
  'url',
  'phone',
  'postalCode',
  'businessId',
  'integer',
  'decimal',
  'code',
  'name',
  'words',
  'sentence',
];

describe('textInputPropsFor', () => {
  test('email does not capitalize and uses the email keyboard', () => {
    expect(textInputPropsFor('email')).toEqual({
      autoCapitalize: 'none',
      autoCorrect: false,
      keyboardType: 'email-address',
      autoComplete: 'email',
      textContentType: 'emailAddress',
    });
  });

  test('url does not capitalize and uses the url keyboard', () => {
    expect(textInputPropsFor('url')).toMatchObject({
      autoCapitalize: 'none',
      autoCorrect: false,
      keyboardType: 'url',
    });
  });

  test('business id and offer-style integers do not capitalize', () => {
    expect(textInputPropsFor('businessId')).toMatchObject({
      autoCapitalize: 'none',
      autoCorrect: false,
      keyboardType: 'numbers-and-punctuation',
    });
    expect(textInputPropsFor('integer')).toMatchObject({
      autoCapitalize: 'none',
      keyboardType: 'numeric',
    });
    expect(textInputPropsFor('code')).toMatchObject({
      autoCapitalize: 'none',
      autoCorrect: false,
    });
    expect(textInputPropsFor('postalCode')).toMatchObject({
      autoCapitalize: 'none',
      keyboardType: 'numeric',
    });
  });

  test('names and addresses stay capitalized by word, free text by sentence', () => {
    expect(textInputPropsFor('name')).toMatchObject({
      autoCapitalize: 'words',
      autoComplete: 'name',
      textContentType: 'name',
    });
    expect(textInputPropsFor('words')).toMatchObject({
      autoCapitalize: 'words',
      autoComplete: 'off',
      textContentType: 'none',
    });
    expect(textInputPropsFor('sentence').autoCapitalize).toBe('sentences');
  });

  test('only a real person name uses name autofill', () => {
    expect(NAME_FIELD_KIND).toEqual({
      customerName: 'name',
      sellerName: 'name',
      companyName: 'words',
      productName: 'code',
      structureName: 'code',
      lineName: 'code',
    });
    expect(textInputPropsFor(NAME_FIELD_KIND.customerName).autoComplete).toBe('name');
    expect(textInputPropsFor(NAME_FIELD_KIND.sellerName).textContentType).toBe('name');
    for (const field of ['productName', 'structureName', 'lineName'] as const) {
      const props = textInputPropsFor(NAME_FIELD_KIND[field]);
      expect(props.autoCapitalize).toBe('none');
      expect(props.autoComplete).not.toBe('name');
      expect(props.textContentType).not.toBe('name');
    }
    expect(textInputPropsFor(NAME_FIELD_KIND.companyName).autoCapitalize).toBe('words');
  });

  test('the real name fields import the shared mapping', () => {
    const uses: Record<string, string> = {
      'src/features/asiakkaat/components/CustomerStep.tsx': 'NAME_FIELD_KIND.customerName',
      'app/settings/company.tsx': 'NAME_FIELD_KIND.sellerName',
      'src/components/product/ProductForm.tsx': 'NAME_FIELD_KIND.productName',
      'app/settings/structures/[id].tsx': 'NAME_FIELD_KIND.structureName',
      'src/components/calculation/StructureLineCard.tsx': 'NAME_FIELD_KIND.lineName',
    };
    for (const [file, token] of Object.entries(uses)) {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(source).toContain("from '@/src/components/textInputProps'");
      expect(source).toContain(token);
      expect(source).not.toContain('kind="name"');
    }
    const company = fs.readFileSync(path.join(__dirname, '../app/settings/company.tsx'), 'utf8');
    expect(company).toContain('NAME_FIELD_KIND.companyName');
  });

  test('every non-prose kind disables autocapitalize', () => {
    const prose = new Set<TextInputKind>(['name', 'words', 'sentence']);
    for (const kind of KINDS) {
      const props = textInputPropsFor(kind);
      if (prose.has(kind)) {
        expect(props.autoCapitalize === 'words' || props.autoCapitalize === 'sentences').toBe(true);
      } else {
        expect(props.autoCapitalize).toBe('none');
        expect(props.autoCorrect).toBe(false);
      }
    }
  });
});
