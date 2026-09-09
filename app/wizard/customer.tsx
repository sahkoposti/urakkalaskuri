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
import { serializeCustomerDetails } from '@/src/core/models/types';
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
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

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

  async function persistAndClose(updateOldCalculations = false, prompted = false) {
    const info = buildInfo();
    if (!info.name) {
      showAlert('Virhe', 'Anna asiakkaan nimi.');
      return;
    }

    if (customerId && !prompted) {
      const existing = customers.find((item) => item.id === customerId);
      if (existing && !customerSnapshotEquals(existing, info)) {
        setUpdateVisible(true);
        return;
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
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Asiakas' }} />
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
          <PrimaryButton title="Valmis" onPress={() => void persistAndClose()} />
        </ScrollView>
      </KeyboardAvoidingView>

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
