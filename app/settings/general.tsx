import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { AppInput, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function GeneralSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { ready, settings, refreshSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [vatPercent, setVatPercent] = useState('');
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState('');
  const [workdayHours, setWorkdayHours] = useState('');
  const [weatherReserveFactor, setWeatherReserveFactor] = useState('');

  useEffect(() => {
    setVatPercent(String(settings.vatPercent));
    setDefaultCommissionPercent(String(settings.defaultCommissionPercent));
    setDefaultHourlyRate(String(settings.defaultHourlyRate));
    setWorkdayHours(String(settings.workdayHours));
    setWeatherReserveFactor(String(settings.weatherReserveFactor).replace('.', ','));
  }, [settings]);

  const isDirty = useMemo(
    () =>
      vatPercent !== String(settings.vatPercent) ||
      defaultCommissionPercent !== String(settings.defaultCommissionPercent) ||
      defaultHourlyRate !== String(settings.defaultHourlyRate) ||
      workdayHours !== String(settings.workdayHours) ||
      weatherReserveFactor.replace(',', '.') !== String(settings.weatherReserveFactor),
    [
      vatPercent,
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
      defaultCommissionPercent: parseNumber(defaultCommissionPercent),
      defaultHourlyRate: parseNumber(defaultHourlyRate),
      workdayHours: parseNumber(workdayHours),
      weatherReserveFactor: parseNumber(weatherReserveFactor),
    };

    if (
      parsed.vatPercent === null ||
      parsed.defaultCommissionPercent === null ||
      parsed.defaultHourlyRate === null ||
      parsed.workdayHours === null ||
      parsed.weatherReserveFactor === null ||
      !(parsed.weatherReserveFactor > 0)
    ) {
      showAlert('Virhe', 'Anna kelvolliset arvot kaikille kentille.');
      return false;
    }

    if (parsed.defaultCommissionPercent < 0 || parsed.defaultCommissionPercent >= 100) {
      showAlert('Virhe', 'Myyntipalkkion on oltava vähintään 0 ja alle 100 %.');
      return false;
    }

    await db.saveSettings({
      ...settings,
      vatPercent: parsed.vatPercent!,
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
        <AppInput
          label="Uuden tuoterakenteen myyntipalkkio (%)"
          value={defaultCommissionPercent}
          onChangeText={setDefaultCommissionPercent}
          keyboardType="decimal-pad"
        />
        <Text style={styles.sectionHint}>
          Palkkio ja kate asetetaan jokaiselle tuoterakenteelle erikseen. Tämä arvo kopioidaan
          uuteen rakenteeseen.
        </Text>
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
