import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandLogo, SectionTitle } from '@/src/components/common';
import { AppCard } from '@/src/components/common';
import { AppColors } from '@/src/theme/colors';

export default function HomeScreen() {
  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <BrandLogo fontSize={20} />,
          headerTitleAlign: 'center',
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <BrandLogo />
          <SectionTitle title="Urakkalaskuri" center />
          <Text style={styles.subtitle}>Laske tarjoushinta vaiheittain.</Text>
        </View>

        <NavCard
          title="Uusi laskenta"
          subtitle="Aloita wizard"
          onPress={() => router.push('/wizard')}
        />
        <NavCard
          title="Historia"
          subtitle="Aiempien laskelmien lista"
          onPress={() => router.push('/history')}
        />
        <NavCard
          title="Tuotteet"
          subtitle="Materiaalit ja hinnat"
          onPress={() => router.push('/products')}
        />
        <NavCard
          title="Asetukset"
          subtitle="ALV, kate, tuntihinta"
          onPress={() => router.push('/settings')}
        />
      </ScrollView>
    </>
  );
}

type NavCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

function NavCard({ title, subtitle, onPress }: NavCardProps) {
  return (
    <AppCard onPress={onPress} style={styles.navCard}>
      <View style={styles.navRow}>
        <View style={styles.navText}>
          <Text style={styles.navTitle}>{title}</Text>
          <Text style={styles.navSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  subtitle: {
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
    textAlign: 'center',
  },
  navCard: {
    marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navText: {
    flex: 1,
  },
  navTitle: {
    fontSize: 17,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
  },
  navSubtitle: {
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
