import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { SectionTitle } from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';

export default function CalculationSettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Laskenta' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Laskenta" />
        <SettingsNavCard
          title="Järjestys"
          subtitle="Wizardin kysymysten järjestys"
          onPress={() => router.push('/settings/calculation/order')}
        />
        <SettingsNavCard
          title="Muuttujat"
          subtitle="Omat kentät ja kaavat"
          onPress={() => router.push('/settings/calculation/variables')}
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
