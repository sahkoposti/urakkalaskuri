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
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from '@/src/context/AppContext';
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
    <AppProvider>
      <StatusBar style="dark" />
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
        <Stack.Screen name="settings" options={{ title: 'Asetukset' }} />
      </Stack>
    </AppProvider>
  );
}
