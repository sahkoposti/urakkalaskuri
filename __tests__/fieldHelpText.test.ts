import { visibleHelpText } from '../src/core/form/fieldHelpText';

describe('visibleHelpText', () => {
  test('returns trimmed text', () => {
    expect(visibleHelpText('  Katso menekki  ')).toBe('Katso menekki');
  });

  test('treats empty and whitespace as missing', () => {
    expect(visibleHelpText(undefined)).toBeUndefined();
    expect(visibleHelpText('')).toBeUndefined();
    expect(visibleHelpText('   ')).toBeUndefined();
  });
});
