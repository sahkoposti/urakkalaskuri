import { router, Stack, type Href } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { SectionTitle } from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';

export default function SettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Asetukset' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Asetukset" />
        <SettingsNavCard
          title="Yleinen"
          subtitle="ALV, kate, palkkio, tuntihinta, työryhmä"
          onPress={() => router.push('/settings/general')}
        />
        <SettingsNavCard
          title="Lomakeasetukset"
          subtitle="Sivut, kentät, kaavat ja debug"
          onPress={() => router.push('/settings/calculation' as Href)}
        />
        <SettingsNavCard
          title="Teema"
          subtitle="Logo, värit, taustakuva"
          onPress={() => router.push('/settings/theme')}
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
