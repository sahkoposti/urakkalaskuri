import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppCard,
  PrimaryButton,
  ResultRow,
  ScreenMessage,
  SectionTitle,
} from '@/src/components/common';
import type { CalculationLine, CalculationRecord } from '@/src/core/models/types';
import { serializeCustomerDetails } from '@/src/core/models/types';
import {
  applyVat,
  customerTypeLabel,
  formatDisplayPrice,
  isPrivateCustomer,
  reverseVatLabel,
} from '@/src/core/utils/priceDisplay';
import { formatCurrency, formatDecimal, formatPercent } from '@/src/core/utils/formatters';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function SummaryScreen() {
  const { wizardSession, refreshCalculations, refreshWizardDraft, setWizardSession } = useApp();

  if (!wizardSession) {
    return <ScreenMessage message="Ei laskentaa" />;
  }

  const { draft, result, settings, editCalculationId, originalCreatedAt } = wizardSession;
  const customer = draft.customer;
  const privateCustomer = isPrivateCustomer(customer);
  const vatRate = settings.vatPercent;
  const totalLabel = privateCustomer ? 'Kokonaishinta (alv)' : 'Kokonaishinta (alv0)';

  async function handleSave() {
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
      lines: draft.lines.map(
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
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle title="Tulos" />
      <AppCard style={styles.card}>
        <ResultRow label="Asiakastyyppi" value={customerTypeLabel(customer)} />
        {!privateCustomer ? (
          <ResultRow label="Käänteinen ALV" value={reverseVatLabel(customer)} />
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.formula}>
          {privateCustomer
            ? 'Kokonaishinta (alv) = urakka + materiaalit + myyntikate + myyntipalkkio + ALV'
            : 'Kokonaishinta (alv0) = urakka + materiaalit + myyntikate + myyntipalkkio'}
        </Text>
        <ResultRow
          label="  Urakkahinta"
          value={formatDisplayPrice(
            result.contractPriceVat0,
            applyVat(result.contractPriceVat0, vatRate),
            customer,
          )}
        />
        <ResultRow
          label="+ Materiaalit"
          value={formatDisplayPrice(
            result.materialsVat0,
            applyVat(result.materialsVat0, vatRate),
            customer,
          )}
        />
        <ResultRow
          label="+ Myyntikate"
          value={formatDisplayPrice(
            result.marginEur,
            applyVat(result.marginEur, vatRate),
            customer,
          )}
        />
        <ResultRow
          label="+ Myyntipalkkio"
          value={formatDisplayPrice(
            result.commissionEur,
            applyVat(result.commissionEur, vatRate),
            customer,
          )}
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
          label={privateCustomer ? 'Urakkahinta (alv)' : 'Urakkahinta (alv0)'}
          value={formatDisplayPrice(
            result.contractPriceVat0,
            applyVat(result.contractPriceVat0, vatRate),
            customer,
          )}
        />
        <ResultRow
          label={privateCustomer ? 'Materiaalit (alv)' : 'Materiaalit (alv0)'}
          value={formatDisplayPrice(
            result.materialsVat0,
            applyVat(result.materialsVat0, vatRate),
            customer,
          )}
        />
        <ResultRow
          label="Myyntikate (€)"
          value={formatDisplayPrice(result.marginEur, applyVat(result.marginEur, vatRate), customer)}
        />
        <ResultRow label="Myyntikate (%)" value={formatPercent(settings.defaultMarginPercent)} />
        <ResultRow
          label="Myyntipalkkio (€)"
          value={formatDisplayPrice(
            result.commissionEur,
            applyVat(result.commissionEur, vatRate),
            customer,
          )}
        />
        <ResultRow
          label="Myyntipalkkio (%)"
          value={formatPercent(settings.defaultCommissionPercent)}
        />
        <View style={styles.divider} />
        {!privateCustomer ? (
          <ResultRow
            label="Kokonaishinta (alv0)"
            value={formatCurrency(result.totalPriceVat0)}
            highlight
          />
        ) : null}
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
        ) : customer.reverseVat ? (
          <ResultRow label="ALV" value="Käänteinen ALV" />
        ) : (
          <>
            <ResultRow label="ALV" value={formatCurrency(result.vatAmount)} />
            <ResultRow label="Kokonaishinta (alv)" value={formatCurrency(result.totalPriceVat)} />
          </>
        )}
      </AppCard>

      <PrimaryButton
        title={editCalculationId ? 'Tallenna muutokset' : 'Tallenna laskelma'}
        onPress={handleSave}
      />
    </ScrollView>
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
  formula: {
    color: AppColors.text,
    opacity: 0.85,
    fontSize: 13,
    fontFamily: 'IBMPlexSans_400Regular',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
    marginVertical: 8,
  },
});
