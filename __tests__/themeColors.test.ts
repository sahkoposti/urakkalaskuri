import { defaultThemeSettings } from '../src/core/models/types';
import { buildAppColors, DEFAULT_APP_COLORS } from '../src/theme/colors';

describe('buildAppColors', () => {
  test('maps theme settings onto the UI palette', () => {
    const colors = buildAppColors({
      ...defaultThemeSettings,
      accentColor: '#112233',
      primaryColor: '#010101',
      textColor: '#444444',
      surfaceColor: '#EEEEEE',
    });
    expect(colors.accent).toBe('#112233');
    expect(colors.primary).toBe('#010101');
    expect(colors.text).toBe('#444444');
    expect(colors.surface).toBe('#EEEEEE');
    expect(colors.secondary).toBe(DEFAULT_APP_COLORS.secondary);
    expect(colors.border).toBe(DEFAULT_APP_COLORS.border);
  });

  test('falls back to defaults for blank colors', () => {
    const colors = buildAppColors({
      ...defaultThemeSettings,
      accentColor: '  ',
      primaryColor: '',
    });
    expect(colors.accent).toBe(DEFAULT_APP_COLORS.accent);
    expect(colors.primary).toBe(DEFAULT_APP_COLORS.primary);
  });
});
