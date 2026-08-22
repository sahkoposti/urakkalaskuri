import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FormSummarySection } from '@/src/components/form/FormSummarySection';
import {
  AppCard,
  PrimaryButton,
  ResultRow,
  ScreenMessage,
  SectionTitle,
} from '@/src/components/common';
import { buildFormSnapshot } from '@/src/core/form/formSummaryHelpers';
import type { CalculationLine, CalculationRecord } from '@/src/core/models/types';
import { serializeCustomerDetails } from '@/src/core/models/types';
import {
  formatContractPriceVat0,
  formatDisplayPrice,
  formatMarginCommissionPrice,
  formatMaterialsPrice,
  isPrivateCustomer,
  materialsPriceLabel,
} from '@/src/core/utils/priceDisplay';
import { formatCurrency, formatDecimal, formatPercent } from '@/src/core/utils/formatters';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function SummaryScreen() {
  const { wizardSession, formDefinition, products, refreshCalculations, refreshWizardDraft, setWizardSession } = useApp();

  if (!wizardSession) {
    return <ScreenMessage message="Ei laskentaa" />;
  }

  const { draft, result, settings, form, formContext, materialLines, editCalculationId, originalCreatedAt } =
    wizardSession;
  const customer = draft.customer;
  const privateCustomer = isPrivateCustomer(customer);
  const vatRate = settings.vatPercent;
  const totalLabel = privateCustomer ? 'Kokonaishinta (alv)' : 'Kokonaishinta (alv0)';

  async function handleSave() {
    const formSnapshot = buildFormSnapshot(formDefinition, form.fieldValues, formContext, products);
    const record: CalculationRecord = {
      id: editCalculationId ?? createId(),
      projectName: draft.customer.name,
      customer: serializeCustomerDetails(draft.customer),
      groupDurationHours: draft.groupDurationHours!,
      crewSize: draft.crewSize!,
      hourlyRate: settings.defaultHourlyRate,
      marginPercent: settings.defaultMarginPercent,
      commissionPercent: settings.defaultCommissionPercent,
      contractPriceVat0: result.contractPriceVat0,
      materialsVat0: result.materialsVat0,
      marginEur: result.marginEur,
      commissionEur: result.commissionEur,
      totalPriceVat0: result.totalPriceVat0,
      vatPercent: settings.vatPercent,
      vatAmount: result.vatAmount,
      totalPriceVat: result.totalPriceVat,
      workDurationDays: result.workDurationDays,
      createdAt: originalCreatedAt ?? new Date(),
      formSnapshot,
      lines: materialLines.map(
        (line): CalculationLine => ({
          id: createId(),
          productId: line.product.id,
          productName: line.product.name,
          unit: line.product.unit,
          unitPriceVat0: line.product.unitPriceVat0,
          quantity: line.quantity,
          lineTotalVat0: line.quantity * line.product.unitPriceVat0,
        }),
      ),
    };

    await db.saveCalculation(record);
    await db.clearWizardDraft();
    await refreshCalculations();
    await refreshWizardDraft();
    setWizardSession(null);
    router.replace('/history');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Yhteenveto' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Tulos" />
        <AppCard style={styles.card}>
          <ResultRow
            label="  Urakkahinta (alv0)"
            value={formatContractPriceVat0(result.contractPriceVat0)}
          />
          <ResultRow
            label={`+ ${materialsPriceLabel(customer)}`}
            value={formatMaterialsPrice(result.materialsVat0, customer, vatRate)}
          />
          <ResultRow
            label="+ Myyntikate (alv0)"
            value={formatMarginCommissionPrice(result.marginEur, customer, vatRate)}
          />
          <ResultRow
            label="+ Myyntipalkkio (alv0)"
            value={formatMarginCommissionPrice(result.commissionEur, customer, vatRate)}
          />
          <View style={styles.divider} />
          <ResultRow
            label={`= ${totalLabel}`}
            value={formatDisplayPrice(result.totalPriceVat0, result.totalPriceVat, customer)}
            highlight
          />
        </AppCard>

        <AppCard style={styles.card}>
          <ResultRow
            label="Työryhmän kesto (pv)"
            value={formatDecimal(result.workDurationDays)}
          />
          <ResultRow label="Työryhmän koko (hlö)" value={String(draft.crewSize)} />
          <ResultRow
            label="Urakkahinta (alv0)"
            value={formatContractPriceVat0(result.contractPriceVat0)}
          />
          <ResultRow
            label={materialsPriceLabel(customer)}
            value={formatMaterialsPrice(result.materialsVat0, customer, vatRate)}
          />
          <ResultRow
            label="Myyntikate (alv0)"
            value={formatMarginCommissionPrice(result.marginEur, customer, vatRate)}
          />
          <ResultRow label="Myyntikate (%)" value={formatPercent(settings.defaultMarginPercent)} />
          <ResultRow
            label="Myyntipalkkio (alv0)"
            value={formatMarginCommissionPrice(result.commissionEur, customer, vatRate)}
          />
          <ResultRow
            label="Myyntipalkkio (%)"
            value={formatPercent(settings.defaultCommissionPercent)}
          />
          <View style={styles.divider} />
          {privateCustomer ? (
            <>
              <ResultRow label="Kokonaishinta (alv0)" value={formatCurrency(result.totalPriceVat0)} />
              <ResultRow
                label={`ALV (${formatPercent(vatRate)})`}
                value={formatCurrency(result.vatAmount)}
              />
              <ResultRow
                label="Kokonaishinta (alv)"
                value={formatCurrency(result.totalPriceVat)}
                highlight
              />
            </>
          ) : (
            <ResultRow
              label="Kokonaishinta (alv0)"
              value={formatCurrency(result.totalPriceVat0)}
              highlight
            />
          )}
        </AppCard>

        <FormSummarySection
          form={formDefinition}
          fieldValues={form.fieldValues}
          context={formContext}
          products={products}
        />

        <PrimaryButton
          title={editCalculationId ? 'Tallenna muutokset' : 'Tallenna laskelma'}
          onPress={handleSave}
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
    marginVertical: 8,
  },
});
