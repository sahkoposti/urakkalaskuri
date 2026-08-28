import { Text, View } from 'react-native';

import { AppCard } from '@/src/components/common';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type SettingsNavCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

export function SettingsNavCard({ title, subtitle, onPress }: SettingsNavCardProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <AppCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </AppCard>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    card: {
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    textWrap: {
      flex: 1,
    },
    title: {
      fontSize: 17,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    subtitle: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    chevron: {
      fontSize: 28,
      color: colors.text,
      lineHeight: 28,
    },
  };
}
