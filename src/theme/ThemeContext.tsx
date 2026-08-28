import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ImageBackground, View } from 'react-native';

import { useApp } from '@/src/context/AppContext';
import { buildAppColors, DEFAULT_APP_COLORS, type AppColorPalette } from '@/src/theme/colors';

const ThemeContext = createContext<AppColorPalette>(DEFAULT_APP_COLORS);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { settings } = useApp();
  const colors = useMemo(() => buildAppColors(settings.theme), [settings.theme]);
  const backgroundUri = settings.theme.backgroundImageUri.trim();
  const opacity = Math.min(100, Math.max(0, settings.theme.backgroundOpacity)) / 100;

  const body = <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;

  if (!backgroundUri) {
    return <View style={{ flex: 1, backgroundColor: colors.surface }}>{body}</View>;
  }

  return (
    <ImageBackground
      source={{ uri: backgroundUri }}
      style={{ flex: 1, backgroundColor: colors.surface }}
      imageStyle={{ opacity }}
    >
      {body}
    </ImageBackground>
  );
}

export function useAppColors(): AppColorPalette {
  return useContext(ThemeContext);
}
