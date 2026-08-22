import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

const HEADER_BODY_HEIGHT = 56;
const BANNER_HEIGHT = 40;

export function DraftResumeBanner() {
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

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
    backgroundColor: AppColors.accent,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPressed: {
    opacity: 0.92,
  },
  bannerText: {
    color: AppColors.secondary,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 15,
  },
});
