import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { DraftResumeBanner } from '@/src/components/DraftResumeBanner';
import { AppProvider } from '@/src/context/AppContext';
import { ThemedAlertProvider } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemedAlertProvider>
          <StatusBar style="dark" />
          <View style={{ flex: 1 }}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: AppColors.secondary },
              headerTintColor: AppColors.primary,
              headerTitleStyle: {
                fontFamily: 'IBMPlexSans_600SemiBold',
                color: AppColors.primary,
              },
              contentStyle: { backgroundColor: AppColors.surface },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Urakkalaskuri' }} />
            <Stack.Screen name="wizard/index" options={{ title: 'Laskenta' }} />
            <Stack.Screen name="wizard/summary" options={{ title: 'Yhteenveto' }} />
            <Stack.Screen name="products/index" options={{ title: 'Tuotteet' }} />
            <Stack.Screen name="products/new" options={{ title: 'Lisää tuote' }} />
            <Stack.Screen name="products/[id]" options={{ title: 'Muokkaa tuotetta' }} />
            <Stack.Screen name="history/index" options={{ title: 'Historia' }} />
            <Stack.Screen name="history/[id]" options={{ title: 'Laskelman tiedot' }} />
            <Stack.Screen name="settings/index" options={{ title: 'Asetukset' }} />
            <Stack.Screen name="settings/general" options={{ title: 'Yleinen' }} />
            <Stack.Screen name="settings/calculation/index" options={{ title: 'Lomakeasetukset' }} />
            <Stack.Screen name="settings/calculation/order" options={{ title: 'Järjestys' }} />
            <Stack.Screen name="settings/calculation/debug" options={{ title: 'Debug' }} />
            <Stack.Screen name="settings/calculation/defaults" options={{ title: 'Oletusarvot' }} />
            <Stack.Screen name="settings/calculation/help" options={{ title: 'Lomakeohje' }} />
            <Stack.Screen name="settings/calculation/pages/index" options={{ title: 'Lomakepohja' }} />
            <Stack.Screen name="settings/calculation/pages/[pageId]" options={{ title: 'Sivu' }} />
            <Stack.Screen name="settings/calculation/fields/index" options={{ title: 'Kentät' }} />
            <Stack.Screen name="settings/calculation/fields/[fieldId]" options={{ title: 'Kenttä' }} />
            <Stack.Screen name="settings/theme" options={{ title: 'Teema' }} />
          </Stack>
          <DraftResumeBanner />
          </View>
        </ThemedAlertProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
