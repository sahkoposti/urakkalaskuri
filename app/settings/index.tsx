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
          subtitle="ALV, palkkio-oletus, tuntihinta, säävaraus"
          onPress={() => router.push('/settings/general')}
        />
        <SettingsNavCard
          title="Tuoterakenteet"
          subtitle="Lomakkeet, kate, palkkio ja työryhmä"
          onPress={() => router.push('/settings/structures' as Href)}
        />
        <SettingsNavCard
          title="Yritys"
          subtitle="Yhteystiedot, Y-tunnus, logo"
          onPress={() => router.push('/settings/company' as Href)}
        />
        <SettingsNavCard
          title="Teema"
          subtitle="Värit, taustakuva"
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
