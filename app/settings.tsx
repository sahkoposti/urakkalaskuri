import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { AppInput, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';

export default function SettingsScreen() {
  const { ready, settings, refreshSettings } = useApp();
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
      Alert.alert('Virhe', 'Anna kelvolliset arvot kaikille kentille.');
      return;
    }

    await db.saveSettings({
      vatPercent: parsed.vatPercent!,
      defaultMarginPercent: parsed.defaultMarginPercent!,
      defaultCommissionPercent: parsed.defaultCommissionPercent!,
      defaultHourlyRate: parsed.defaultHourlyRate!,
      defaultCrewSize: parsed.defaultCrewSize!,
      workdayHours: parsed.workdayHours!,
    });
    await refreshSettings();
    Alert.alert('Tallennettu', 'Asetukset tallennettu');
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
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
  );
}
