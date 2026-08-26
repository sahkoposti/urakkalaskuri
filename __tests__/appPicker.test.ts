import { pickerDisplayLabel } from '../src/components/pickerDisplayLabel';

describe('pickerDisplayLabel', () => {
  const items = [
    { label: 'Paneeli', value: '1.15' },
    { label: 'Hirsi', value: '1' },
  ];

  test('returns the selected option label', () => {
    expect(pickerDisplayLabel(items, '1.15')).toBe('Paneeli');
  });

  test('returns placeholder when nothing is selected', () => {
    expect(pickerDisplayLabel(items, '', 'Valitse...')).toBe('Valitse...');
  });

  test('returns placeholder when value is unknown', () => {
    expect(pickerDisplayLabel(items, 'missing', 'Valitse...')).toBe('Valitse...');
  });
});
