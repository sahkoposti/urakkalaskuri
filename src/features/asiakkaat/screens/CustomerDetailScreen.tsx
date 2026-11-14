import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { PrimaryButton, ScreenLoading, ScreenMessage } from '@/src/components/common';
import { CustomerStep } from '@/src/components/form/CustomerStep';
import { UpdateOldCalculationsDialog } from '@/src/components/UpdateOldCalculationsDialog';
import {
  customerFromInfo,
  customerSnapshotEquals,
} from '@/src/core/customer/customerRegister';
import { serializeCustomerDetails } from '@/src/core/models/types';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useCustomerFormState } from '@/src/hooks/useCustomerFormState';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function CustomerEditScreen() {
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const customerId = Array.isArray(id) ? id[0] : id;
  const { customers, refreshCustomers, refreshCalculations } = useApp();
  const { showAlert } = useThemedAlert();
  const customer = customers.find((item) => item.id === customerId);
  const { applySeed, buildInfo, customerStepProps } = useCustomerFormState({
    id: customer?.id,
    name: customer?.name,
    customerType: customer?.customerType,
    reverseVat: customer?.reverseVat,
    phone: customer?.phone,
    email: customer?.email,
    address: customer?.address,
    postalCode: customer?.postalCode,
    postalLocality: customer?.postalLocality,
    notes: customer?.notes,
  });
  const [updateVisible, setUpdateVisible] = useState(false);

  useEffect(() => {
    if (!customer) return;
    applySeed({
      id: customer.id,
      name: customer.name,
      customerType: customer.customerType,
      reverseVat: customer.reverseVat,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      postalCode: customer.postalCode,
      postalLocality: customer.postalLocality,
      notes: customer.notes,
    });
  }, [customer?.id]);

  if (!customerId) return <ScreenMessage message="Asiakasta ei löytynyt." />;
  if (!customer) return <ScreenLoading />;

  async function handleSave(updateOldCalculations = false, prompted = false) {
    const info = buildInfo();
    if (!info.name) {
      showAlert('Virhe', 'Anna asiakkaan nimi.');
      return;
    }
    if (!prompted && !customerSnapshotEquals(customer!, info)) {
      setUpdateVisible(true);
      return;
    }
    await db.upsertCustomer(customerFromInfo(customerId, info));
    if (updateOldCalculations) {
      await db.updateCalculationCustomerSnapshots(
        customerId,
        info.name,
        serializeCustomerDetails(info),
      );
      await refreshCalculations();
    }
    await refreshCustomers();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: customer.name }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <CustomerStep {...customerStepProps} />
          <PrimaryButton title="Tallenna" onPress={() => void handleSave()} />
        </ScrollView>
      </KeyboardAvoidingView>
      <UpdateOldCalculationsDialog
        visible={updateVisible}
        onClose={() => setUpdateVisible(false)}
        onKeepOld={() => {
          setUpdateVisible(false);
          void handleSave(false, true);
        }}
        onUpdate={() => {
          setUpdateVisible(false);
          void handleSave(true, true);
        }}
      />
    </>
  );
}

function createStyles(_colors: AppColorPalette) {
  return {
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
  };
}
