import { router, Stack, type Href } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { BrandLogo, SectionTitle } from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { db, useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function HomeScreen() {
  const styles = useThemedStyles(createStyles);
  const { refreshWizardDraft, refreshCalculations } = useApp();

  async function handleNewCalculation() {
    await db.beginNewCalculation();
    await refreshWizardDraft();
    await refreshCalculations();
    router.push('/wizard');
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <BrandLogo width={170} />,
          headerTitleAlign: 'center',
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <SectionTitle title="Urakkalaskuri" center />
        </View>

        <SettingsNavCard
          title="Uusi laskenta"
          subtitle="Aloita laskenta"
          onPress={handleNewCalculation}
          accent
        />
        <SettingsNavCard
          title="Historia"
          subtitle="Aiempien laskelmien lista"
          onPress={() => router.push('/history')}
        />
        <SettingsNavCard
          title="Tuotteet"
          subtitle="Materiaalit ja hinnat"
          onPress={() => router.push('/products')}
        />
        <SettingsNavCard
          title="Asiakkaat"
          subtitle="Asiakasrekisteri"
          onPress={() => router.push('/customers' as Href)}
        />
        <SettingsNavCard
          title="Asetukset"
          subtitle="ALV, kate, tuoterakenteet"
          onPress={() => router.push('/settings' as Href)}
        />
      </ScrollView>
    </>
  );
}

function createStyles(_colors: AppColorPalette) {
  return {
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    hero: {
      alignItems: 'center' as const,
      marginBottom: 24,
      gap: 8,
    },
  };
}
