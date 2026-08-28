import { router, usePathname } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

const HEADER_BODY_HEIGHT = 56;
const BANNER_HEIGHT = 40;

export function DraftResumeBanner() {
  const styles = useThemedStyles(createStyles);
  const { wizardDraft } = useApp();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  if (!wizardDraft || pathname.startsWith('/wizard')) {
    return null;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.banner,
        {
          top: insets.top + HEADER_BODY_HEIGHT - BANNER_HEIGHT,
          height: BANNER_HEIGHT,
        },
        pressed && styles.bannerPressed,
      ]}
      onPress={() => router.push('/wizard')}
    >
      <Text style={styles.bannerText}>Jatka laskentaa →</Text>
    </Pressable>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    banner: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      zIndex: 100,
      elevation: 100,
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    bannerPressed: {
      opacity: 0.92,
    },
    bannerText: {
      color: colors.secondary,
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 15,
    },
  };
}
