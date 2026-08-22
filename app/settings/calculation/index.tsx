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
          title="Sivut"
          subtitle="Sivut, järjestys ja kenttien valinta lomakkeelle"
          onPress={() => router.push('/settings/calculation/pages' as Href)}
        />
        <SettingsNavCard
          title="Kentät"
          subtitle="Lisää kenttiä, valintalistoja ja kaavoja"
          onPress={() => router.push('/settings/calculation/fields' as Href)}
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
