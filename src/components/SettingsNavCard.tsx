import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/src/components/common';
import { AppColors } from '@/src/theme/colors';

type SettingsNavCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

export function SettingsNavCard({ title, subtitle, onPress }: SettingsNavCardProps) {
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

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
  },
  subtitle: {
    marginTop: 4,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  chevron: {
    fontSize: 28,
    color: AppColors.text,
    lineHeight: 28,
  },
});
