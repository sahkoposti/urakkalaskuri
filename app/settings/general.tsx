import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppInput, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';

export default function GeneralSettingsScreen() {
  const { ready, settings, refreshSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [vatPercent, setVatPercent] = useState('');
  const [defaultMarginPercent, setDefaultMarginPercent] = useState('');
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
  const [defaultCrewSize, setDefaultCrewSize] = useState('');
  const [workdayHours, setWorkdayHours] = useState('');

  useEffect(() => {
    setVatPercent(String(settings.vatPercent));
    setDefaultMarginPercent(String(settings.defaultMarginPercent));
    setDefaultCommissionPercent(String(settings.defaultCommissionPercent));
    setDefaultHourlyRate(String(settings.defaultHourlyRate));
    setDefaultCrewSize(String(settings.defaultCrewSize));
    setWorkdayHours(String(settings.workdayHours));
  }, [settings]);

  if (!ready) return <ScreenLoading />;

  async function handleSave() {
    const parsed = {
      vatPercent: parseNumber(vatPercent),
      defaultMarginPercent: parseNumber(defaultMarginPercent),
      defaultCommissionPercent: parseNumber(defaultCommissionPercent),
      defaultHourlyRate: parseNumber(defaultHourlyRate),
      defaultCrewSize: Number.parseInt(defaultCrewSize, 10),
      workdayHours: parseNumber(workdayHours),
    };

    if (
      Object.values(parsed).some((value) => value === null || !Number.isFinite(value)) ||
      (parsed.defaultCrewSize ?? 0) <= 0
    ) {
      showAlert('Virhe', 'Anna kelvolliset arvot kaikille kentille.');
      return;
    }

    await db.saveSettings({
      ...settings,
      vatPercent: parsed.vatPercent!,
      defaultMarginPercent: parsed.defaultMarginPercent!,
      defaultCommissionPercent: parsed.defaultCommissionPercent!,
      defaultHourlyRate: parsed.defaultHourlyRate!,
      defaultCrewSize: parsed.defaultCrewSize!,
      workdayHours: parsed.workdayHours!,
    });
    await refreshSettings();
    showAlert('Tallennettu', 'Yleiset asetukset tallennettu', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Yleinen' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppInput
          label="ALV (%)"
          value={vatPercent}
          onChangeText={setVatPercent}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Myyntikatetavoite (%)"
          value={defaultMarginPercent}
          onChangeText={setDefaultMarginPercent}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Myyntipalkkio (%)"
          value={defaultCommissionPercent}
          onChangeText={setDefaultCommissionPercent}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Tuntihinta (alv0) €/h"
          value={defaultHourlyRate}
          onChangeText={setDefaultHourlyRate}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Oletustyöryhmän koko (hlö)"
          value={defaultCrewSize}
          onChangeText={setDefaultCrewSize}
          keyboardType="numeric"
        />
        <AppInput
          label="Työpäivän pituus (h)"
          value={workdayHours}
          onChangeText={setWorkdayHours}
          keyboardType="decimal-pad"
        />
        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 4,
    paddingBottom: 32,
  },
});
