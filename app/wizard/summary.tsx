import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';

import { ScreenMessage } from '@/src/components/common';
import { resetToHistoryDetail } from '@/src/core/navigation/appStack';
import { firstNonEmptyId } from '@/src/core/wizard/wizardDraftHelpers';
import { useApp } from '@/src/context/AppContext';

/** Vanha yhteenveto-osoite ohjaa tallennetun laskelman yhteiseen näkymään. */
export default function SummaryScreen() {
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { wizardDraft } = useApp();
  const savedId = firstNonEmptyId(id, wizardDraft?.editCalculationId);

  useEffect(() => {
    if (!savedId) return;
    resetToHistoryDetail(navigation, savedId);
  }, [navigation, savedId]);

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
