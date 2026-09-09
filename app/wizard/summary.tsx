import { router, Stack } from 'expo-router';
import { useEffect } from 'react';

import { ScreenMessage } from '@/src/components/common';
import { useApp } from '@/src/context/AppContext';

/** Vanha yhteenveto-osoite ohjaa tallennetun laskelman yhteiseen näkymään. */
export default function SummaryScreen() {
  const { wizardSession } = useApp();
  const savedId = wizardSession?.editCalculationId;

  useEffect(() => {
    if (!savedId) return;
    router.replace({
      pathname: '/history/[id]',
      params: { id: savedId, from: 'wizard' },
    });
  }, [savedId]);

  if (!savedId) {
    return (
      <>
        <Stack.Screen options={{ title: 'Yhteenveto' }} />
        <ScreenMessage message="Ei laskentaa" />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Yhteenveto' }} />
      <ScreenMessage message="Avataan laskelma…" />
    </>
  );
}
