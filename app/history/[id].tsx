import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { CalculationDetailView } from '@/src/components/calculation/CalculationDetailView';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { ScreenLoading, ScreenMessage } from '@/src/components/common';
import {
  PENDING_EDIT_NOTICE,
  hasPendingEditDraft,
  shouldClearDraftOnDetailClose,
} from '@/src/core/history/detailDraftPolicy';
import { customerFromRecord, type CalculationRecord } from '@/src/core/models/types';
import { resetToHistoryList } from '@/src/core/navigation/appStack';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';

export default function HistoryDetailScreen() {
  const navigation = useNavigation();
  const { id, from } = useLocalSearchParams<{ id: string | string[]; from?: string | string[] }>();
  const calcId = Array.isArray(id) ? id[0] : id;
  const fromWizard = (Array.isArray(from) ? from[0] : from) === 'wizard';
  const { showAlert } = useThemedAlert();
  const {
    formDefinition,
    refreshWizardDraft,
    refreshCalculations,
    wizardDraft,
  } = useApp();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<CalculationRecord | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (loadedIdRef.current !== (calcId ?? null)) {
        setLoading(true);
      }
      (async () => {
        const loaded = await db.getCalculation(calcId);
        if (!active) return;
        loadedIdRef.current = calcId ?? null;
        setRecord(loaded);
        setLoading(false);
      })();
      return () => {
        active = false;
      };
    }, [calcId]),
  );

  function goToHistoryList() {
    resetToHistoryList(navigation);
  }

  async function handleClose() {
    if (
      shouldClearDraftOnDetailClose({
        fromWizard,
        draftEditId: wizardDraft?.editCalculationId,
        calcId,
      })
    ) {
      await db.clearWizardDraft();
      await refreshWizardDraft();
      goToHistoryList();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    goToHistoryList();
  }

  async function handleDelete() {
    if (!calcId) return;
    try {
      await db.deleteCalculation(calcId);
      if (wizardDraft?.editCalculationId === calcId) {
        await db.clearWizardDraft();
        await refreshWizardDraft();
      }
      await refreshCalculations();
      setDeleteVisible(false);
      goToHistoryList();
    } catch (error) {
      console.error(error);
      setDeleteVisible(false);
      showAlert('Virhe', 'Laskelman poistaminen epäonnistui.');
    }
  }

  if (loading) return <ScreenLoading />;
  if (!record) return <ScreenMessage message="Laskelmaa ei löytynyt." />;

  return (
    <>
      <Stack.Screen options={{ title: 'Laskelman tiedot' }} />
      <CalculationDetailView
        record={record}
        formDefinition={formDefinition}
        unsavedChangesNotice={
          hasPendingEditDraft(record, wizardDraft) ? PENDING_EDIT_NOTICE : null
        }
        onCopy={() => showAlert('Kopioitu', 'Tieto kopioitu leikepöydälle.')}
        onFooterPress={() => {
          void handleClose();
        }}
        onDeletePress={() => setDeleteVisible(true)}
      />
      <ConfirmDialog
        visible={deleteVisible}
        title="Poista laskelma?"
        message={`Poistetaanko laskelma asiakkaalle "${customerFromRecord(record).name}"? Tätä ei voi perua.`}
        onClose={() => setDeleteVisible(false)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDeleteVisible(false) },
          {
            title: 'Poista',
            variant: 'destructive',
            onPress: () => {
              void handleDelete();
            },
          },
        ]}
      />
    </>
  );
}
