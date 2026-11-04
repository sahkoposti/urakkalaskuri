import type { AppColorPalette } from '@/src/theme/colors';

export function createPdfFormStyles(colors: AppColorPalette) {
  return {
    hint: {
      marginBottom: 8,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
    warning: {
      marginBottom: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      backgroundColor: colors.surface,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
  };
}
