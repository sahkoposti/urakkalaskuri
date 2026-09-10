import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppInput, AppPercentSlider, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

function maxMarginPercent(commissionPercent: number): number {
  return Math.max(0, 99 - commissionPercent);
}

export default function GeneralSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { ready, settings, refreshSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [vatPercent, setVatPercent] = useState('');
  const [marginLowAmount, setMarginLowAmount] = useState('');
  const [marginLowPercent, setMarginLowPercent] = useState(settings.marginLowPercent);
  const [marginHighAmount, setMarginHighAmount] = useState('');
  const [marginHighPercent, setMarginHighPercent] = useState(settings.marginHighPercent);
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
  const [workdayHours, setWorkdayHours] = useState('');
  const [weatherReserveFactor, setWeatherReserveFactor] = useState('');

  useEffect(() => {
    setVatPercent(String(settings.vatPercent));
    setMarginLowAmount(String(settings.marginLowAmount));
    setMarginLowPercent(settings.marginLowPercent);
    setMarginHighAmount(String(settings.marginHighAmount));
    setMarginHighPercent(settings.marginHighPercent);
    setDefaultCommissionPercent(String(settings.defaultCommissionPercent));
    setDefaultHourlyRate(String(settings.defaultHourlyRate));
    setWorkdayHours(String(settings.workdayHours));
    setWeatherReserveFactor(String(settings.weatherReserveFactor).replace('.', ','));
  }, [settings]);

  const commissionValue =
    parseNumber(defaultCommissionPercent) ?? settings.defaultCommissionPercent;
  const marginMax = maxMarginPercent(commissionValue);

  useEffect(() => {
    setMarginLowPercent((current) => Math.min(current, marginMax));
    setMarginHighPercent((current) => Math.min(current, marginMax));
  }, [marginMax]);

  const isDirty = useMemo(
    () =>
      vatPercent !== String(settings.vatPercent) ||
      marginLowAmount !== String(settings.marginLowAmount) ||
      marginLowPercent !== settings.marginLowPercent ||
      marginHighAmount !== String(settings.marginHighAmount) ||
      marginHighPercent !== settings.marginHighPercent ||
      defaultCommissionPercent !== String(settings.defaultCommissionPercent) ||
      defaultHourlyRate !== String(settings.defaultHourlyRate) ||
      workdayHours !== String(settings.workdayHours) ||
      weatherReserveFactor.replace(',', '.') !== String(settings.weatherReserveFactor),
    [
      vatPercent,
      marginLowAmount,
      marginLowPercent,
      marginHighAmount,
      marginHighPercent,
      defaultCommissionPercent,
      defaultHourlyRate,
      workdayHours,
      weatherReserveFactor,
      settings,
    ],
  );

  async function persistSettings(): Promise<boolean> {
    const parsed = {
      vatPercent: parseNumber(vatPercent),
      marginLowAmount: parseNumber(marginLowAmount),
      marginLowPercent,
      marginHighAmount: parseNumber(marginHighAmount),
      marginHighPercent,
      defaultCommissionPercent: parseNumber(defaultCommissionPercent),
      defaultHourlyRate: parseNumber(defaultHourlyRate),
      workdayHours: parseNumber(workdayHours),
      weatherReserveFactor: parseNumber(weatherReserveFactor),
    };

    if (
      parsed.vatPercent === null ||
      parsed.marginLowAmount === null ||
      parsed.marginHighAmount === null ||
      !Number.isFinite(parsed.marginLowPercent) ||
      !Number.isFinite(parsed.marginHighPercent) ||
      parsed.defaultCommissionPercent === null ||
      parsed.defaultHourlyRate === null ||
      parsed.workdayHours === null ||
      parsed.weatherReserveFactor === null ||
      !(parsed.weatherReserveFactor > 0)
    ) {
      showAlert('Virhe', 'Anna kelvolliset arvot kaikille kentille.');
      return false;
    }

    if (!(parsed.marginLowAmount > 0) || !(parsed.marginHighAmount > parsed.marginLowAmount)) {
      showAlert('Virhe', 'Suuren urakan rajan on oltava suurempi kuin pienen urakan raja.');
      return false;
    }

    if (
      parsed.marginLowPercent + parsed.defaultCommissionPercent! >= 100 ||
      parsed.marginHighPercent + parsed.defaultCommissionPercent! >= 100
    ) {
      showAlert('Virhe', 'Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.');
      return false;
    }

    await db.saveSettings({
      ...settings,
      vatPercent: parsed.vatPercent!,
      defaultMarginPercent: parsed.marginLowPercent,
      marginLowAmount: parsed.marginLowAmount!,
      marginLowPercent: parsed.marginLowPercent,
      marginHighAmount: parsed.marginHighAmount!,
      marginHighPercent: parsed.marginHighPercent,
      defaultCommissionPercent: parsed.defaultCommissionPercent!,
      defaultHourlyRate: parsed.defaultHourlyRate!,
      defaultCrewSize: settings.defaultCrewSize,
      workdayHours: parsed.workdayHours!,
      weatherReserveFactor: parsed.weatherReserveFactor!,
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
        <Text style={styles.sectionHint}>
          Kate on yrityksen osuus myyntihinnasta (ALV 0). Palkkio tulee lisäksi. Kate liukuu
          lineaarisesti pienen ja suuren urakan rajan välillä.
        </Text>
        <AppInput
          label="Pienen urakan raja (€, ALV 0)"
          value={marginLowAmount}
          onChangeText={setMarginLowAmount}
          keyboardType="decimal-pad"
        />
        <AppPercentSlider
          label="Kate pienellä urakalla (%)"
          value={marginLowPercent}
          onChange={setMarginLowPercent}
          min={0}
          max={marginMax}
          step={1}
        />
        <AppInput
          label="Suuren urakan raja (€, ALV 0)"
          value={marginHighAmount}
          onChangeText={setMarginHighAmount}
          keyboardType="decimal-pad"
        />
        <AppPercentSlider
          label="Kate suurella urakalla (%)"
          value={marginHighPercent}
          onChange={setMarginHighPercent}
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
          label="Tuntihinta (ALV 0) €/h"
          value={defaultHourlyRate}
          onChangeText={setDefaultHourlyRate}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Työpäivän pituus (h)"
          value={workdayHours}
          onChangeText={setWorkdayHours}
          keyboardType="decimal-pad"
        />
        <AppInput
          label="Säävarauskerroin työn kestolle"
          value={weatherReserveFactor}
          onChangeText={setWeatherReserveFactor}
          keyboardType="decimal-pad"
        />
        <Text style={styles.sectionHint}>
          Kerroin vaikuttaa vain yhteenvedon arvioituun työn kestoon. Se kerrotaan kestolla ennen
          pyöristystä ylöspäin (oletus 1,3). Hinnoittelu käyttää laskettua kestoa ilman kerrointa.
        </Text>
        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
      {exitDialog}
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      gap: 4,
      paddingBottom: 32,
    },
    sectionHint: {
      marginTop: 4,
      marginBottom: 8,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
    },
  };
}
