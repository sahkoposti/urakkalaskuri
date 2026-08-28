import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import type { AppColorPalette } from '@/src/theme/colors';
import { useAppColors } from '@/src/theme/ThemeContext';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/** Luo StyleSheet uudelleen kun teema-värit muuttuvat. `factory` pidä moduulitasolla. */
export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (colors: AppColorPalette) => T,
): T {
  const colors = useAppColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
}
