import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function NotFoundScreen() {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <Stack.Screen options={{ title: 'Sivua ei löydy' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Sivua ei löydy.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Takaisin etusivulle</Text>
        </Link>
      </View>
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    container: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 20,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: 20,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
    },
    link: {
      marginTop: 15,
      paddingVertical: 15,
    },
    linkText: {
      fontSize: 16,
      color: colors.accent,
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
  };
}
