import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppInput, AppPercentSlider, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';

function maxMarginPercent(commissionPercent: number): number {
  return Math.max(0, 99 - commissionPercent);
}

export default function GeneralSettingsScreen() {
  const { ready, settings, refreshSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [vatPercent, setVatPercent] = useState('');
  const [defaultMarginPercent, setDefaultMarginPercent] = useState(settings.defaultMarginPercent);
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
  const [defaultCrewSize, setDefaultCrewSize] = useState('');
  const [workdayHours, setWorkdayHours] = useState('');

  useEffect(() => {
    setVatPercent(String(settings.vatPercent));
    setDefaultMarginPercent(settings.defaultMarginPercent);
    setDefaultCommissionPercent(String(settings.defaultCommissionPercent));
    setDefaultHourlyRate(String(settings.defaultHourlyRate));
    setDefaultCrewSize(String(settings.defaultCrewSize));
    setWorkdayHours(String(settings.workdayHours));
  }, [settings]);

  const commissionValue =
    parseNumber(defaultCommissionPercent) ?? settings.defaultCommissionPercent;
  const marginMax = maxMarginPercent(commissionValue);

  useEffect(() => {
    setDefaultMarginPercent((current) => Math.min(current, marginMax));
  }, [marginMax]);

  const isDirty = useMemo(
    () =>
      vatPercent !== String(settings.vatPercent) ||
      defaultMarginPercent !== settings.defaultMarginPercent ||
      defaultCommissionPercent !== String(settings.defaultCommissionPercent) ||
      defaultHourlyRate !== String(settings.defaultHourlyRate) ||
      defaultCrewSize !== String(settings.defaultCrewSize) ||
      workdayHours !== String(settings.workdayHours),
    [
      vatPercent,
      defaultMarginPercent,
      defaultCommissionPercent,
      defaultHourlyRate,
      defaultCrewSize,
      workdayHours,
      settings,
    ],
  );

  async function persistSettings(): Promise<boolean> {
    const parsed = {
      vatPercent: parseNumber(vatPercent),
      defaultMarginPercent,
      defaultCommissionPercent: parseNumber(defaultCommissionPercent),
      defaultHourlyRate: parseNumber(defaultHourlyRate),
      defaultCrewSize: Number.parseInt(defaultCrewSize, 10),
      workdayHours: parseNumber(workdayHours),
    };

    if (
      parsed.vatPercent === null ||
      !Number.isFinite(parsed.defaultMarginPercent) ||
      parsed.defaultCommissionPercent === null ||
      parsed.defaultHourlyRate === null ||
      parsed.defaultCrewSize === null ||
      !Number.isFinite(parsed.defaultCrewSize) ||
      parsed.workdayHours === null ||
      parsed.defaultCrewSize <= 0
    ) {
      showAlert('Virhe', 'Anna kelvolliset arvot kaikille kentille.');
      return false;
    }

    if (parsed.defaultMarginPercent + parsed.defaultCommissionPercent! >= 100) {
      showAlert('Virhe', 'Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.');
      return false;
    }

    await db.saveSettings({
      ...settings,
      vatPercent: parsed.vatPercent!,
      defaultMarginPercent: parsed.defaultMarginPercent,
      defaultCommissionPercent: parsed.defaultCommissionPercent!,
      defaultHourlyRate: parsed.defaultHourlyRate!,
      defaultCrewSize: parsed.defaultCrewSize!,
      workdayHours: parsed.workdayHours!,
    });
    await refreshSettings();
    return true;
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!ready) return <ScreenLoading />;

  async function handleSave() {
    const saved = await save();
    if (!saved) return;
    allowExit();
    router.back();
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
        <AppPercentSlider
          label="Myyntikatetavoite (%)"
          value={defaultMarginPercent}
          onChange={setDefaultMarginPercent}
          min={0}
          max={marginMax}
          step={1}
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
      {exitDialog}
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
