import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppInput, BrandLogo, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { defaultThemeSettings } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function ThemeSettingsScreen() {
  const { ready, settings, refreshSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [accentColor, setAccentColor] = useState(defaultThemeSettings.accentColor);
  const [primaryColor, setPrimaryColor] = useState(defaultThemeSettings.primaryColor);
  const [textColor, setTextColor] = useState(defaultThemeSettings.textColor);
  const [surfaceColor, setSurfaceColor] = useState(defaultThemeSettings.surfaceColor);
  const [backgroundImageUri, setBackgroundImageUri] = useState('');
  const [backgroundOpacity, setBackgroundOpacity] = useState('100');

  useEffect(() => {
    setAccentColor(settings.theme.accentColor);
    setPrimaryColor(settings.theme.primaryColor);
    setTextColor(settings.theme.textColor);
    setSurfaceColor(settings.theme.surfaceColor);
    setBackgroundImageUri(settings.theme.backgroundImageUri);
    setBackgroundOpacity(String(settings.theme.backgroundOpacity));
  }, [settings.theme]);

  if (!ready) return <ScreenLoading />;

  async function handleSave() {
    const opacity = parseNumber(backgroundOpacity);
    if (opacity === null || opacity < 0 || opacity > 100) {
      showAlert('Virhe', 'Taustakuvan himmeys on oltava välillä 0–100.');
      return;
    }

    await db.saveSettings({
      ...settings,
      theme: {
        accentColor: accentColor.trim() || defaultThemeSettings.accentColor,
        primaryColor: primaryColor.trim() || defaultThemeSettings.primaryColor,
        textColor: textColor.trim() || defaultThemeSettings.textColor,
        surfaceColor: surfaceColor.trim() || defaultThemeSettings.surfaceColor,
        backgroundImageUri: backgroundImageUri.trim(),
        backgroundOpacity: opacity,
      },
    });
    await refreshSettings();
    showAlert('Tallennettu', 'Teema-asetukset tallennettu', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Teema' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Logo</Text>
        <View style={styles.logoPreview}>
          <BrandLogo width={220} />
        </View>
        <Text style={styles.note}>
          Oletuslogo ColoRajaton. Oma logotiedoston valinta tulee myöhemmin.
        </Text>

        <Text style={styles.sectionLabel}>Värit</Text>
        <AppInput label="Korostusväri (hex)" value={accentColor} onChangeText={setAccentColor} />
        <AppInput label="Pääväri (hex)" value={primaryColor} onChangeText={setPrimaryColor} />
        <AppInput label="Tekstiväri (hex)" value={textColor} onChangeText={setTextColor} />
        <AppInput label="Pintaväri (hex)" value={surfaceColor} onChangeText={setSurfaceColor} />

        <Text style={styles.sectionLabel}>Taustakuva</Text>
        <AppInput
          label="Taustakuvan polku / URI"
          value={backgroundImageUri}
          onChangeText={setBackgroundImageUri}
          placeholder="Valinnainen"
        />
        <AppInput
          label="Taustakuvan himmeys (0–100 %)"
          value={backgroundOpacity}
          onChangeText={setBackgroundOpacity}
          keyboardType="decimal-pad"
        />
        <Text style={styles.note}>
          Taustakuvan esikatselu ja valinta galleriasta tulevat myöhemmin. Himmeys 100 = täysin
          näkyvä, 0 = läpinäkyvä.
        </Text>

        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
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
    color: AppColors.primary,
  },
  logoPreview: {
    alignItems: 'center',
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    paddingVertical: 20,
  },
  note: {
    marginTop: 4,
    marginBottom: 8,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
});
