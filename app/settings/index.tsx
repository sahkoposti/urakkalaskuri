import { router, Stack, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { SectionTitle } from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { formatAppVersionLabel, readAppVersion } from '@/src/core/documents/appVersion';

export default function SettingsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Asetukset' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Asetukset" />
        <SettingsNavCard
          title="Yleinen"
          subtitle="ALV, palkkio-oletus, tuntihinta, säävaraus, sivukulukerroin"
          onPress={() => router.push('/settings/general')}
        />
        <SettingsNavCard
          title="Tuoterakenteet"
          subtitle="Lomakkeet, kate, palkkio ja työryhmä"
          onPress={() => router.push('/settings/structures' as Href)}
        />
        <SettingsNavCard
          title="Tarjous"
          subtitle="Numerointi, voimassaolo, lisätiedot, kotitalousvähennys"
          onPress={() => router.push('/settings/calculation/offer')}
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
        <Text style={styles.version}>{formatAppVersionLabel(readAppVersion())}</Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  version: {
    marginTop: 16,
    color: '#333',
    fontSize: 13,
  },
});
