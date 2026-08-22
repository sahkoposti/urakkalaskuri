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
import { formatCurrency, formatDecimal, formatPercent } from '@/src/core/utils/formatters';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function SummaryScreen() {
  const { wizardSession, refreshCalculations, refreshWizardDraft, setWizardSession } = useApp();

  if (!wizardSession) {
    return <ScreenMessage message="Ei laskentaa" />;
  }

  const { draft, result, settings } = wizardSession;

  async function handleSave() {
    const record: CalculationRecord = {
      id: createId(),
      projectName: draft.customer.name,
      customer: serializeCustomerDetails(draft.customer),
      groupDurationHours: draft.groupDurationHours!,
      crewSize: draft.crewSize!,
      hourlyRate: settings.defaultHourlyRate,
      marginPercent: draft.marginPercent!,
      commissionPercent: draft.commissionPercent!,
      contractPriceVat0: result.contractPriceVat0,
      materialsVat0: result.materialsVat0,
      marginEur: result.marginEur,
      commissionEur: result.commissionEur,
      totalPriceVat0: result.totalPriceVat0,
      vatAmount: result.vatAmount,
      totalPriceVat: result.totalPriceVat,
      workDurationDays: result.workDurationDays,
      createdAt: new Date(),
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
        <Text style={styles.formula}>
          Kokonaishinta (alv0) = urakka + materiaalit + myyntikate + myyntipalkkio
        </Text>
        <ResultRow label="  Urakkahinta" value={formatCurrency(result.contractPriceVat0)} />
        <ResultRow label="+ Materiaalit" value={formatCurrency(result.materialsVat0)} />
        <ResultRow label="+ Myyntikate" value={formatCurrency(result.marginEur)} />
        <ResultRow label="+ Myyntipalkkio" value={formatCurrency(result.commissionEur)} />
        <View style={styles.divider} />
        <ResultRow
          label="= Kokonaishinta (alv0)"
          value={formatCurrency(result.totalPriceVat0)}
          highlight
        />
      </AppCard>

      <AppCard style={styles.card}>
        <ResultRow
          label="Työryhmän kesto (pv)"
          value={formatDecimal(result.workDurationDays)}
        />
        <ResultRow label="Työryhmän koko (hlö)" value={String(draft.crewSize)} />
        <ResultRow label="Urakkahinta (alv0)" value={formatCurrency(result.contractPriceVat0)} />
        <ResultRow label="Materiaalit (alv0)" value={formatCurrency(result.materialsVat0)} />
        <ResultRow label="Myyntikate (€)" value={formatCurrency(result.marginEur)} />
        <ResultRow label="Myyntikate (%)" value={formatPercent(draft.marginPercent!)} />
        <ResultRow label="Myyntipalkkio (€)" value={formatCurrency(result.commissionEur)} />
        <ResultRow label="Myyntipalkkio (%)" value={formatPercent(draft.commissionPercent!)} />
        <View style={styles.divider} />
        <ResultRow
          label="Kokonaishinta (alv0)"
          value={formatCurrency(result.totalPriceVat0)}
          highlight
        />
        <ResultRow
          label={`ALV (${formatPercent(settings.vatPercent)})`}
          value={formatCurrency(result.vatAmount)}
        />
        <ResultRow
          label="Kokonaishinta (alv)"
          value={formatCurrency(result.totalPriceVat)}
          highlight
        />
      </AppCard>

      <PrimaryButton title="Tallenna laskelma" onPress={handleSave} />
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
