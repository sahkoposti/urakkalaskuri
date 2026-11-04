import type { TextInputProps } from 'react-native';

/**
 * Näppäimistö ja kirjainkoko kentän lajin mukaan.
 * Sähköposti, www ja tunnukset eivät saa automaattista isoa alkukirjainta.
 * Nimet ja osoitteet pysyvät sanoittain, vapaa teksti lauseittain.
 */
export type TextInputKind =
  | 'email'
  | 'url'
  | 'phone'
  | 'postalCode'
  | 'businessId'
  | 'integer'
  | 'decimal'
  | 'code'
  | 'name'
  | 'words'
  | 'sentence';

export type TextInputKindProps = Pick<
  TextInputProps,
  'autoCapitalize' | 'autoCorrect' | 'keyboardType' | 'autoComplete' | 'textContentType'
>;

const TABLE: Record<TextInputKind, TextInputKindProps> = {
  email: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'email-address',
    autoComplete: 'email',
    textContentType: 'emailAddress',
  },
  url: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'url',
    autoComplete: 'url',
    textContentType: 'URL',
  },
  phone: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'phone-pad',
    autoComplete: 'tel',
    textContentType: 'telephoneNumber',
  },
  postalCode: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'numeric',
    autoComplete: 'postal-code',
    textContentType: 'postalCode',
  },
  businessId: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'numbers-and-punctuation',
    autoComplete: 'off',
    textContentType: 'none',
  },
  integer: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'numeric',
    autoComplete: 'off',
    textContentType: 'none',
  },
  decimal: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'decimal-pad',
    autoComplete: 'off',
    textContentType: 'none',
  },
  code: {
    autoCapitalize: 'none',
    autoCorrect: false,
    keyboardType: 'default',
    autoComplete: 'off',
    textContentType: 'none',
  },
  name: {
    autoCapitalize: 'words',
    autoCorrect: true,
    keyboardType: 'default',
    autoComplete: 'name',
    textContentType: 'name',
  },
  words: {
    autoCapitalize: 'words',
    autoCorrect: true,
    keyboardType: 'default',
    autoComplete: 'off',
    textContentType: 'none',
  },
  sentence: {
    autoCapitalize: 'sentences',
    autoCorrect: true,
    keyboardType: 'default',
    autoComplete: 'off',
    textContentType: 'none',
  },
};

export function textInputPropsFor(kind: TextInputKind): TextInputKindProps {
  return TABLE[kind];
}
