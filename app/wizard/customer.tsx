import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { PrimaryButton } from '@/src/components/common';
import { CustomerStep } from '@/src/components/form/CustomerStep';
import { UpdateOldCalculationsDialog } from '@/src/components/UpdateOldCalculationsDialog';
import {
  customerFromInfo,
  customerSnapshotEquals,
  searchCustomersByName,
} from '@/src/core/customer/customerRegister';
import {
  serializeCustomerDetails,
  type CustomerInfo,
} from '@/src/core/models/types';
import { createId } from '@/src/core/utils/id';
import {
  buildPersistedWizardDraft,
  firstNonEmptyId,
  mergeWizardDraftEditMeta,
  persistedDraftToFormState,
} from '@/src/core/wizard/wizardDraftHelpers';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useCustomerFormState } from '@/src/hooks/useCustomerFormState';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

function customerEditorSignature(info: CustomerInfo, id?: string) {
  return JSON.stringify({
    id: id ?? '',
    name: info.name,
    customerType: info.customerType ?? 'private',
    reverseVat: Boolean(info.reverseVat),
    phone: info.phone ?? '',
    email: info.email ?? '',
    address: info.address ?? '',
    postalCode: info.postalCode ?? '',
    postalLocality: info.postalLocality ?? '',
    notes: info.notes ?? '',
  });
}

export default function WizardCustomerScreen() {
  const styles = useThemedStyles(createStyles);
  const { editId: rawEditId } = useLocalSearchParams<{ editId?: string | string[] }>();
  const routeEditId = firstNonEmptyId(rawEditId);
  const { wizardDraft, customers, products, refreshWizardDraft, refreshCustomers } = useApp();
  const { showAlert } = useThemedAlert();
  const initial = wizardDraft
    ? persistedDraftToFormState(wizardDraft, products).form
    : undefined;
  const {
    customerId,
    setCustomerId,
    applyCustomer,
    buildInfo,
    customerStepProps,
  } = useCustomerFormState({
    id: initial?.customerId,
    name: initial?.customerName,
    customerType: initial?.customerType,
    reverseVat: initial?.reverseVat,
    phone: initial?.customerPhone,
    email: initial?.customerEmail,
    address: initial?.customerAddress,
    postalCode: initial?.customerPostalCode,
    postalLocality: initial?.customerPostalLocality,
    notes: initial?.customerNotes,
  });
  const [updateVisible, setUpdateVisible] = useState(false);
  const savedSignature = customerEditorSignature(
    {
      name: (initial?.customerName ?? '').trim(),
      customerType: initial?.customerType ?? 'private',
      reverseVat: Boolean(initial?.reverseVat),
      phone: initial?.customerPhone?.trim() || undefined,
      email: initial?.customerEmail?.trim() || undefined,
      address: initial?.customerAddress?.trim() || undefined,
      postalCode: initial?.customerPostalCode?.trim() || undefined,
      postalLocality: initial?.customerPostalLocality?.trim() || undefined,
      notes: initial?.customerNotes?.trim() || undefined,
    },
    initial?.customerId,
  );
  const isDirty = customerEditorSignature(buildInfo(), customerId) !== savedSignature;

  const matches = useMemo(
    () => searchCustomersByName(customers, customerStepProps.name),
    [customers, customerStepProps.name],
  );

  async function writeDraft(nextCustomerId?: string) {
    if (!wizardDraft) return;
    const { form } = persistedDraftToFormState(wizardDraft, products);
    const info = buildInfo();
    await db.saveWizardDraft(
      buildPersistedWizardDraft(
        {
          ...form,
          customerName: info.name,
          customerType: info.customerType ?? 'private',
          reverseVat: Boolean(info.reverseVat),
          customerPhone: info.phone ?? '',
          customerEmail: info.email ?? '',
          customerAddress: info.address ?? '',
          customerPostalCode: info.postalCode ?? '',
          customerPostalLocality: info.postalLocality ?? '',
          customerNotes: info.notes ?? '',
          customerId: nextCustomerId ?? customerId,
        },
        mergeWizardDraftEditMeta(
          {
            editCalculationId: routeEditId,
            originalCreatedAt: wizardDraft.originalCreatedAt,
            editFormVersion: wizardDraft.editFormVersion,
          },
          wizardDraft,
        ),
        wizardDraft,
      ),
    );
    await refreshWizardDraft();
  }

  async function persistCustomer(updateOldCalculations = false, prompted = false): Promise<boolean> {
    const info = buildInfo();
    if (!info.name) {
      showAlert('Virhe', 'Anna asiakkaan nimi.');
      return false;
    }

    if (customerId && !prompted) {
      const existing = customers.find((item) => item.id === customerId);
      if (existing && !customerSnapshotEquals(existing, info)) {
        setUpdateVisible(true);
        return false;
      }
    }

    let nextId = customerId;
    if (nextId) {
      await db.upsertCustomer(customerFromInfo(nextId, info));
      if (updateOldCalculations) {
        await db.updateCalculationCustomerSnapshots(
          nextId,
          info.name,
          serializeCustomerDetails(info),
        );
      }
    } else {
      nextId = createId();
      await db.upsertCustomer(customerFromInfo(nextId, info));
      setCustomerId(nextId);
    }
    await refreshCustomers();
    await writeDraft(nextId);
    return true;
  }

  const { allowExit, exitDialog, save, stackScreenOptions } = useUnsavedChangesGuard({
    isDirty,
    onSave: () => persistCustomer(),
    title: 'Tallentamattomia muutoksia',
    message: 'Haluatko tallentaa asiakastiedot ennen poistumista?',
    discardTitle: 'Sulje tallentamatta',
    saveTitle: 'Tallenna',
  });

  async function persistAndClose(updateOldCalculations = false, prompted = false) {
    const saved = await persistCustomer(updateOldCalculations, prompted);
    if (!saved) return;
    allowExit();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Asiakas', ...stackScreenOptions }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <CustomerStep
            {...customerStepProps}
            nameMatches={matches}
            onPickCustomer={applyCustomer}
          />
          <PrimaryButton
            title="Valmis"
            onPress={() => {
              void (async () => {
                const saved = await save();
                if (!saved) return;
                allowExit();
                router.back();
              })();
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {exitDialog}
      <UpdateOldCalculationsDialog
        visible={updateVisible}
        onClose={() => setUpdateVisible(false)}
        onKeepOld={() => {
          setUpdateVisible(false);
          void persistAndClose(false, true);
        }}
        onUpdate={() => {
          setUpdateVisible(false);
          void persistAndClose(true, true);
        }}
      />
    </>
  );
}

function createStyles(_colors: AppColorPalette) {
  return {
    container: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
  };
}
