import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Text } from 'react-native';

import { AppInput, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { PhoneFolderBar } from '@/src/components/pdf/CalculationDocumentList';
import {
  getPhoneDocumentsDirectoryUri,
  savePhoneDocumentsDirectoryUri,
} from '@/src/core/database/database';
import { phoneFolderRowLabel } from '@/src/core/documents/documentLabels';
import { pickPhoneDirectory } from '@/src/core/documents/phoneFolderIo';
import { PHONE_FOLDER_TEMPORARY_NOTE } from '@/src/core/documents/phoneSave';
import {
  formatSivukulukerroin,
  sivukulukerroinDraftError,
  withSivukulukerroin,
} from '@/src/core/pdf/defaultOfferSettings';
import type { OfferCompanySettings } from '@/src/core/pdf/types';
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
  const [offerSettings, setOfferSettings] = useState<OfferCompanySettings | null>(null);
  const [factorText, setFactorText] = useState('');

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void db.getOfferCompanySettings().then((loaded) => {
      if (!active) return;
      setOfferSettings(loaded);
      setFactorText(formatSivukulukerroin(loaded.sivukulukerroin));
    });
    return () => {
      active = false;
    };
  }, [ready]);

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
      weatherReserveFactor.replace(',', '.') !== String(settings.weatherReserveFactor) ||
      (offerSettings != null && factorText !== formatSivukulukerroin(offerSettings.sivukulukerroin)),
    [
      vatPercent,
      defaultCommissionPercent,
      defaultHourlyRate,
      workdayHours,
      weatherReserveFactor,
      factorText,
      offerSettings,
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

    if (offerSettings) {
      const factorError = sivukulukerroinDraftError(factorText);
      if (factorError) {
        showAlert('Tarkista sivukulukerroin', factorError);
        return false;
      }
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
    if (offerSettings) {
      const nextOffer = withSivukulukerroin(offerSettings, factorText);
      await db.saveOfferCompanySettings(nextOffer);
      setOfferSettings(nextOffer);
      setFactorText(formatSivukulukerroin(nextOffer.sivukulukerroin));
    }
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
          kind="decimal"
        />
        <AppInput
          label="Uuden tuoterakenteen myyntipalkkio (%)"
          value={defaultCommissionPercent}
          onChangeText={setDefaultCommissionPercent}
          kind="decimal"
        />
        <Text style={styles.sectionHint}>
          Palkkio ja kate asetetaan jokaiselle tuoterakenteelle erikseen. Tämä arvo kopioidaan
          uuteen rakenteeseen.
        </Text>
        <AppInput
          label="Tuntihinta (ALV 0) €/h"
          value={defaultHourlyRate}
          onChangeText={setDefaultHourlyRate}
          kind="decimal"
        />
        <AppInput
          label="Työpäivän pituus (h)"
          value={workdayHours}
          onChangeText={setWorkdayHours}
          kind="decimal"
        />
        <AppInput
          label="Säävarauskerroin työn kestolle"
          value={weatherReserveFactor}
          onChangeText={setWeatherReserveFactor}
          kind="decimal"
        />
        <Text style={styles.sectionHint}>
          Kerroin vaikuttaa vain yhteenvedon arvioituun työn kestoon. Se kerrotaan kestolla ennen
          pyöristystä ylöspäin (oletus 1,3). Hinnoittelu käyttää laskettua kestoa ilman kerrointa.
        </Text>
        <AppInput
          label="Sivukulukerroin"
          value={factorText}
          onChangeText={setFactorText}
          kind="decimal"
          placeholder="1,5"
        />
        {sivukulukerroinDraftError(factorText) ? (
          <Text style={styles.fieldError}>{sivukulukerroinDraftError(factorText)}</Text>
        ) : null}
        <Text style={styles.sectionHint}>
          Urakkakortin työntekijähinta on urakka jaettuna tällä. Arvoa ei tulosteta kortille. Tyhjä = 1,5.
          Sallittu alue on suurempi kuin 1 ja enintään 3.
        </Text>
        {Platform.OS === 'android' ? <PhoneFolderSettings /> : null}
        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
      {exitDialog}
    </>
  );
}

function PhoneFolderSettings() {
  const { showAlert } = useThemedAlert();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    void getPhoneDocumentsDirectoryUri().then(setUri).catch((error: unknown) => {
      console.error(error);
    });
  }, []);
  return (
    <PhoneFolderBar
      label={phoneFolderRowLabel(uri)}
      note={PHONE_FOLDER_TEMPORARY_NOTE}
      onChange={() => {
        void pickPhoneDirectory().then(async (directory) => {
          if (!directory) return;
          try {
            await savePhoneDocumentsDirectoryUri(directory.uri);
            setUri(directory.uri);
          } catch (error) {
            console.error(error);
            showAlert('Kansiota ei voitu tallentaa', 'Kansion tallennus epäonnistui.');
          }
        });
      }}
      onClear={() => {
        void savePhoneDocumentsDirectoryUri(null)
          .then(() => setUri(null))
          .catch((error: unknown) => {
            console.error(error);
            showAlert('Kansiota ei voitu tyhjentää', 'Kansion tyhjennys epäonnistui.');
          });
      }}
    />
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      gap: 4,
      paddingBottom: 32,
    },
    fieldError: {
      marginTop: 4,
      color: '#C90000',
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
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
