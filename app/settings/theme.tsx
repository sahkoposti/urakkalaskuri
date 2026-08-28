import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppInput, BrandLogo, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { defaultThemeSettings } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function ThemeSettingsScreen() {
  const styles = useThemedStyles(createStyles);
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

  const isDirty = useMemo(
    () =>
      accentColor !== settings.theme.accentColor ||
      primaryColor !== settings.theme.primaryColor ||
      textColor !== settings.theme.textColor ||
      surfaceColor !== settings.theme.surfaceColor ||
      backgroundImageUri !== settings.theme.backgroundImageUri ||
      backgroundOpacity !== String(settings.theme.backgroundOpacity),
    [
      accentColor,
      primaryColor,
      textColor,
      surfaceColor,
      backgroundImageUri,
      backgroundOpacity,
      settings.theme,
    ],
  );

  async function persistSettings(): Promise<boolean> {
    const opacity = parseNumber(backgroundOpacity);
    if (opacity === null || opacity < 0 || opacity > 100) {
      showAlert('Virhe', 'Taustakuvan himmeys on oltava välillä 0–100.');
      return false;
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
