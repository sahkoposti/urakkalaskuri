import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppInput, BrandLogo, PrimaryButton, ScreenLoading } from '@/src/components/common';
import {
  cleanCompanyProfile,
  companyProfilesEqual,
  defaultCompanyProfile,
} from '@/src/core/company/defaultCompany';
import type { CompanyProfile } from '@/src/core/company/types';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type TextKey = Exclude<keyof CompanyProfile, 'logoUri'>;

const FIELDS: {
  key: TextKey;
  label: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  placeholder?: string;
}[] = [
  { key: 'companyName', label: 'Yrityksen nimi' },
  { key: 'address', label: 'Katuosoite' },
  { key: 'postalCode', label: 'Postinumero', keyboardType: 'numeric' },
  { key: 'postalLocality', label: 'Postitoimipaikka' },
  { key: 'website', label: 'Www-sivu' },
  { key: 'email', label: 'Sähköposti', keyboardType: 'email-address' },
  { key: 'businessId', label: 'Y-tunnus' },
  { key: 'phone', label: 'Puhelin', keyboardType: 'phone-pad' },
  { key: 'sellerName', label: 'Myyjän nimi' },
  {
    key: 'sellerPhone',
    label: 'Myyjän puhelin',
    keyboardType: 'phone-pad',
    placeholder: 'Tyhjä = yrityksen puhelin/sähköposti',
  },
  {
    key: 'sellerEmail',
    label: 'Myyjän sähköposti',
    keyboardType: 'email-address',
    placeholder: 'Tyhjä = yrityksen puhelin/sähköposti',
  },
];

export default function CompanySettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { ready } = useApp();
  const { showAlert } = useThemedAlert();
  const [loaded, setLoaded] = useState(false);
  const [stored, setStored] = useState<CompanyProfile>({ ...defaultCompanyProfile });
  const [draft, setDraft] = useState<CompanyProfile>({ ...defaultCompanyProfile });

  useEffect(() => {
    let active = true;
    db.getCompanyProfile()
      .then((profile) => {
        if (!active) return;
        setStored(profile);
        setDraft(profile);
      })
      .catch(() => {
        if (active) showAlert('Virhe', 'Yrityksen tietojen lataus epäonnistui. Näytetään oletukset.');
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [showAlert]);

  const isDirty = useMemo(() => loaded && !companyProfilesEqual(draft, stored), [draft, stored, loaded]);

  async function persist(): Promise<boolean> {
    try {
      const cleaned = cleanCompanyProfile(draft);
      await db.saveCompanyProfile(cleaned);
      setStored(cleaned);
      setDraft(cleaned);
      return true;
    } catch {
      showAlert('Virhe', 'Tallennus epäonnistui.');
      return false;
    }
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({ isDirty, onSave: persist });

  if (!ready || !loaded) return <ScreenLoading />;

  async function handleSave() {
    const saved = await save();
    if (!saved) return;
    allowExit();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Yritys' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Logo</Text>
        <View style={styles.logoPreview}>
          <BrandLogo width={220} />
        </View>
        <Text style={styles.note}>
          Oletuslogo ColoRajaton (näkyy tarjous-PDF:n ylätunnisteessa). Oma logotiedoston valinta tulee myöhemmin.
        </Text>

        <Text style={styles.sectionLabel}>Yhteystiedot</Text>
        {FIELDS.map((field) => (
          <AppInput
            key={field.key}
            label={field.label}
            value={draft[field.key] ?? ''}
            keyboardType={field.keyboardType}
            onChangeText={(value) => setDraft((prev) => ({ ...prev, [field.key]: value }))}
            placeholder={field.placeholder ?? 'Valinnainen'}
          />
        ))}
        <Text style={styles.note}>Tyhjä kenttä jätetään pois PDF:n alatunnisteesta.</Text>

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
      paddingBottom: 32,
      gap: 4,
    },
    sectionLabel: {
      marginTop: 12,
      marginBottom: 8,
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 16,
      color: colors.primary,
    },
    logoPreview: {
      alignItems: 'center' as const,
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      paddingVertical: 20,
    },
    note: {
      marginTop: 4,
      marginBottom: 8,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
    },
  };
}
