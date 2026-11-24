import { router, Stack, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { AppInput, OutlinedButton, PrimaryButton, SectionTitle } from '@/src/components/common';
import { isOnlineSendEnabled } from '@/src/core/online/flag';
import { getServerClient, getServerUrl, setServerUrl } from '@/src/core/online/onlineRuntime';
import { onlineSendErrorMessage } from '@/src/core/online/sendOnlineOffer';

/**
 * Palvelin (online-lähetys). Näkyy vain, kun EXPO_PUBLIC_ONLINE_SEND=1.
 * Salasanaa ei tallenneta; kenttä tyhjennetään kirjautumisen jälkeen.
 */
export default function OnlineSettingsScreenRoute() {
  if (!isOnlineSendEnabled()) return <Text style={{ padding: 20 }}>Ei käytössä.</Text>;
  return <OnlineSettingsScreen />;
}

function OnlineSettingsScreen() {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        setUrl((await getServerUrl()) ?? '');
        const client = await getServerClient();
        setSignedIn(client ? await client.isSignedIn() : false);
      } catch {
        // Esim. salatun säilön lukuvirhe: näytetään uloskirjautuneena, ei kaatumista (T-42).
        setSignedIn(false);
      }
    })();
  }, []);

  const login = async () => {
    setBusy(true);
    setMessage('');
    try {
      if (!(await setServerUrl(url))) {
        setMessage('Osoite ei kelpaa. Käytä https-osoitetta.');
        return;
      }
      const client = await getServerClient();
      if (!client) return;
      await client.login(username.trim(), password);
      setSignedIn(true);
      setMessage('Kirjautuminen onnistui.');
    } catch (error) {
      setMessage(onlineSendErrorMessage(error));
    } finally {
      setPassword('');
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      const client = await getServerClient();
      const revoked = client ? await client.logout() : true;
      setSignedIn(false);
      setMessage(revoked ? 'Kirjauduttu ulos.' : 'Kirjauduttu ulos. Palvelimen istunto suljetaan, kun yhteys palaa.');
    } catch {
      setMessage('Uloskirjautuminen ei onnistunut. Yritä uudelleen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Palvelin' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle title="Palvelin" />
        <Text style={styles.hint}>
          Tarjoukset lähetetään palvelimelle, joka antaa tarjousnumeron. Vanhat tarjoukset pysyvät puhelimessa.
        </Text>
        <AppInput label="Palvelimen osoite" value={url} onChangeText={setUrl} kind="url" />
        {signedIn ? (
          <>
            <Text style={styles.status}>Kirjautunut palvelimelle.</Text>
            <OutlinedButton title="Käynnit" onPress={() => router.push('/settings/kaynnit' as Href)} />
            <OutlinedButton title="Kirjaudu ulos" onPress={logout} disabled={busy} />
          </>
        ) : (
          <>
            <AppInput label="Käyttäjätunnus" value={username} onChangeText={setUsername} kind="code" />
            <Text style={styles.label}>Salasana</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              textContentType="password"
              style={styles.password}
              accessibilityLabel="Salasana"
            />
            <PrimaryButton
              title={busy ? 'Kirjaudutaan…' : 'Kirjaudu'}
              onPress={login}
              disabled={busy || !url.trim() || !username.trim() || !password}
            />
          </>
        )}
        {message ? (
          <Text style={styles.message} accessibilityRole="alert">
            {message}
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 8 },
  hint: { color: '#333', fontSize: 14, marginBottom: 8 },
  status: { fontSize: 15, marginVertical: 8 },
  label: { fontSize: 14, marginTop: 4 },
  password: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 10, fontSize: 16 },
  message: { marginTop: 12, fontSize: 14 },
});
