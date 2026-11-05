import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CalculationDetailView } from '@/src/components/calculation/CalculationDetailView';
import { ATTACHMENT_REMOVE_COPIED_LABEL } from '@/src/core/attachments/attachmentMessages';
import { listAttachments, removeAllAttachments } from '@/src/core/attachments/attachmentsRepository';
import { commitCalculationCopy } from '@/src/core/attachments/commitCalculationCopy';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { ScreenLoading, ScreenMessage } from '@/src/components/common';
import {
  PENDING_EDIT_NOTICE,
  hasPendingEditDraft,
  shouldClearDraftOnDetailClose,
} from '@/src/core/history/detailDraftPolicy';
import { customerFromRecord, type CalculationRecord } from '@/src/core/models/types';
import { createId } from '@/src/core/utils/id';
import { resetToHistoryList } from '@/src/core/navigation/appStack';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';

export default function HistoryDetailScreen() {
  const navigation = useNavigation();
  const { id, from, copyNotice, copyCanRemove } = useLocalSearchParams<{
    id: string | string[];
    from?: string | string[];
    copyNotice?: string | string[];
    copyCanRemove?: string | string[];
  }>();
  const calcId = Array.isArray(id) ? id[0] : id;
  const fromWizard = (Array.isArray(from) ? from[0] : from) === 'wizard';
  const notice = Array.isArray(copyNotice) ? copyNotice[0] : copyNotice;
  const canRemoveCopies = (Array.isArray(copyCanRemove) ? copyCanRemove[0] : copyCanRemove) === '1';
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
  const [attachmentEpoch, setAttachmentEpoch] = useState(0);
  const loadedIdRef = useRef<string | null>(null);
  const announcedCopy = useRef<string | null>(null);

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

  useEffect(() => {
    if (!notice || !calcId) return;
    const key = `${calcId}:${notice}`;
    if (announcedCopy.current === key) return;
    announcedCopy.current = key;
    showAlert(
      'Laskelma kopioitu',
      notice,
      canRemoveCopies
        ? [
            {
              text: ATTACHMENT_REMOVE_COPIED_LABEL,
              style: 'destructive',
              onPress: () => {
                void removeAllAttachments(calcId)
                  .then(() => setAttachmentEpoch((value) => value + 1))
                  .catch((error: unknown) => {
                    console.error(error);
                    showAlert('Liitteet', 'Kopioitujen liitteiden poistaminen epäonnistui.');
                  });
              },
            },
            { text: 'OK' },
          ]
        : undefined,
    );
  }, [notice, canRemoveCopies, calcId, showAlert]);

  async function handleCopyCalculation() {
    if (!record || !calcId) return;
    try {
      const result = await commitCalculationCopy(record, {
        newId: createId,
        copyCalculationRecord: (source, newId) => db.copyCalculationRecord(source, newId),
        saveCalculation: (next) => db.saveCalculation(next),
        removeAllAttachments,
        listAttachments,
      });
      if (!result.ok) {
        showAlert('Virhe', result.message);
        return;
      }
      await refreshCalculations();
      router.push({
        pathname: '/history/[id]',
        params: {
          id: result.record.id,
          copyNotice: result.message,
          copyCanRemove: result.offerRemove ? '1' : '0',
        },
      });
    } catch (error) {
      console.error(error);
      showAlert('Virhe', 'Laskelman kopiointi epäonnistui.');
    }
  }

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
        onCopyCalculation={() => {
          void handleCopyCalculation();
        }}
        onRecordChange={setRecord}
        attachmentEpoch={attachmentEpoch}
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
