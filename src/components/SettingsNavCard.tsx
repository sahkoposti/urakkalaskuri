import { Text, View } from 'react-native';

import { AppCard } from '@/src/components/common';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type SettingsNavCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
  accent?: boolean;
};

export function SettingsNavCard({ title, subtitle, onPress, accent = false }: SettingsNavCardProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <AppCard onPress={onPress} style={[styles.card, accent && styles.cardAccent]}>
      <View style={styles.row}>
        <View style={styles.textWrap}>
          <Text style={[styles.title, accent && styles.titleAccent]}>{title}</Text>
          <Text style={[styles.subtitle, accent && styles.subtitleAccent]}>{subtitle}</Text>
        </View>
        <Text style={[styles.chevron, accent && styles.chevronAccent]}>›</Text>
      </View>
    </AppCard>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    card: {
      marginBottom: 12,
    },
    cardAccent: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
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
    titleAccent: {
      color: colors.secondary,
    },
    subtitle: {
      marginTop: 4,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    subtitleAccent: {
      color: colors.secondary,
    },
    chevron: {
      fontSize: 28,
      color: colors.text,
      lineHeight: 28,
    },
    chevronAccent: {
      color: colors.secondary,
    },
  };
}
