import { textInputPropsFor, type TextInputKind } from '../src/components/textInputProps';

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
    expect(textInputPropsFor('name').autoCapitalize).toBe('words');
    expect(textInputPropsFor('words').autoCapitalize).toBe('words');
    expect(textInputPropsFor('sentence').autoCapitalize).toBe('sentences');
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
