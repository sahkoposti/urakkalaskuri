import type { ThemeSettings } from '@/src/core/models/types';

export type AppColorPalette = {
  primary: string;
  secondary: string;
  text: string;
  accent: string;
  surface: string;
  border: string;
};

export const DEFAULT_APP_COLORS: AppColorPalette = {
  primary: '#000000',
  secondary: '#FFFFFF',
  text: '#3C3C3C',
  accent: '#C90000',
  surface: '#F9FAFA',
  border: '#E1E8ED',
};

/** Oletuspaletti; näytöt käyttävät `useAppColors()` jotta teema-asetukset vaikuttavat. */
export const AppColors = DEFAULT_APP_COLORS;

function pickColor(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/** Karttaa Teema-asetukset UI-palettiin. Korttien valkoinen ja reunus pysyvät brändin oletuksina. */
export function buildAppColors(theme?: ThemeSettings): AppColorPalette {
  return {
    primary: pickColor(theme?.primaryColor, DEFAULT_APP_COLORS.primary),
    secondary: DEFAULT_APP_COLORS.secondary,
    text: pickColor(theme?.textColor, DEFAULT_APP_COLORS.text),
    accent: pickColor(theme?.accentColor, DEFAULT_APP_COLORS.accent),
    surface: pickColor(theme?.surfaceColor, DEFAULT_APP_COLORS.surface),
    border: DEFAULT_APP_COLORS.border,
  };
}
