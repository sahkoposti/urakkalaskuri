import { Stack } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { OutlinedButton, SectionTitle } from '@/src/components/common';
import { isOnlineSendEnabled } from '@/src/core/online/flag';
import { getServerClient } from '@/src/core/online/onlineRuntime';
import { onlineSendErrorMessage } from '@/src/core/online/sendOnlineOffer';
import type { Visit } from '@/src/core/online/serverClient';
import { formatVisitTime, visitAddress } from '@/src/core/online/visits';

/** Myyjän omat käynnit palvelimelta (/v1/kaynnit). Vain luku. */
export default function VisitsScreenRoute() {
  if (!isOnlineSendEnabled()) return <Text style={{ padding: 20 }}>Ei käytössä.</Text>;
  return <VisitsScreen />;
}

function VisitsScreen() {
  const [visits, setVisits] = useState<Visit[] | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    try {
      const client = await getServerClient();
      if (!client) {
        setMessage('Aseta palvelimen osoite ja kirjaudu ensin.');
        return;
      }
      setVisits(await client.visits());
    } catch (error) {
      setMessage(onlineSendErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Stack.Screen options={{ title: 'Käynnit' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Käynnit" />
        {message ? <Text accessibilityRole="alert">{message}</Text> : null}
        {visits && visits.length === 0 ? <Text>Ei sovittuja käyntejä.</Text> : null}
        {visits?.map((visit) => (
          <View key={visit.visit_id} style={styles.card}>
            <Text style={styles.time}>{formatVisitTime(visit)}</Text>
            <Text>{visit.customer?.name ?? 'Asiakas'}</Text>
            <Text>{visitAddress(visit)}</Text>
            {visit.notes ? <Text style={styles.notes}>{visit.notes}</Text> : null}
          </View>
        ))}
        <OutlinedButton title="Päivitä" onPress={load} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  card: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, gap: 2 },
  time: { fontWeight: '600' },
  notes: { color: '#444', marginTop: 4 },
});
