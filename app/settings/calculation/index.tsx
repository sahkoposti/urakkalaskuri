import { router, Stack, type Href } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { SectionTitle } from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';

export default function CalculationSettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Lomakeasetukset' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Lomakeasetukset" />
        <SettingsNavCard
          title="Kentät"
          subtitle="Lomakekentät, kaavat ja debug-esimerkit"
          onPress={() => router.push('/settings/calculation/fields' as Href)}
        />
        <SettingsNavCard
          title="Järjestys"
          subtitle="Laskennan vaiheiden järjestys (v1)"
          onPress={() => router.push('/settings/calculation/order')}
        />
        <SettingsNavCard
          title="Debug"
          subtitle="Live-laskenta kaavojen kalibrointiin"
          onPress={() => router.push('/settings/calculation/debug')}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
});
