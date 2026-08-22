import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppCard, PrimaryButton, ScreenLoading } from '@/src/components/common';
import type { FormDebugSettings } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function FormDebugSettingsScreen() {
  const { ready, formDebug, refreshFormSettings } = useApp();
  const [debug, setDebug] = useState<FormDebugSettings>(formDebug);

  useEffect(() => {
    setDebug(formDebug);
  }, [formDebug]);

  if (!ready) return <ScreenLoading />;

  async function handleSave() {
    await db.saveFormDebugSettings(debug);
    await refreshFormSettings();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Debug' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.title}>Debug-tila</Text>
              <Text style={styles.body}>
                Kun päällä, jokaisella syötekentällä voi asettaa esimerkkiarvon. Kaava-asetukset
                näyttävät live-laskennan näiden arvojen pohjalta.
              </Text>
            </View>
            <Switch
              value={debug.enabled}
              onValueChange={(enabled) => setDebug((current) => ({ ...current, enabled }))}
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.title}>Näytä välivaiheet</Text>
              <Text style={styles.body}>Listaa kaikki laskentavaiheet live-paneelissa.</Text>
            </View>
            <Switch
              value={debug.showIntermediateSteps}
              onValueChange={(showIntermediateSteps) =>
                setDebug((current) => ({ ...current, showIntermediateSteps }))
              }
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        </AppCard>

        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    marginTop: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  title: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
    marginBottom: 6,
  },
  body: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 20,
  },
});
