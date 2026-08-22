import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppCard,
  ResultRow,
  ScreenLoading,
  ScreenMessage,
  SectionTitle,
} from '@/src/components/common';
import type { CalculationRecord } from '@/src/core/models/types';
import { formatCurrency, formatDecimal, formatPercent } from '@/src/core/utils/formatters';
import { db } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<CalculationRecord | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await db.getCalculation(id);
      if (active) {
        setRecord(loaded);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <ScreenLoading />;
  if (!record) return <ScreenMessage message="Laskelmaa ei löytynyt." />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionTitle title={record.projectName} />
      <AppCard style={styles.card}>
        <ResultRow label="Asiakas" value={record.customer ?? '–'} />
        <ResultRow label="Työryhmän kesto (h)" value={formatDecimal(record.groupDurationHours)} />
        <ResultRow label="Työryhmän koko (hlö)" value={`${record.crewSize} hlö`} />
        <ResultRow label="Tuntihinta (alv0)" value={formatCurrency(record.hourlyRate)} />
        <ResultRow label="Urakkahinta (alv0)" value={formatCurrency(record.contractPriceVat0)} />
        <ResultRow label="Materiaalit (alv0)" value={formatCurrency(record.materialsVat0)} />
        <ResultRow label="Myyntikate (€)" value={formatCurrency(record.marginEur)} />
        <ResultRow label="Myyntikate (%)" value={formatPercent(record.marginPercent)} />
        <ResultRow label="Myyntipalkkio (€)" value={formatCurrency(record.commissionEur)} />
        <ResultRow label="Myyntipalkkio (%)" value={formatPercent(record.commissionPercent)} />
        <View style={styles.divider} />
        <ResultRow
          label="Kokonaishinta (alv0)"
          value={formatCurrency(record.totalPriceVat0)}
          highlight
        />
        <ResultRow label="ALV" value={formatCurrency(record.vatAmount)} />
        <ResultRow
          label="Kokonaishinta (alv)"
          value={formatCurrency(record.totalPriceVat)}
          highlight
        />
        <ResultRow label="Työkesto (pv)" value={formatDecimal(record.workDurationDays)} />
      </AppCard>

      {record.lines.length > 0 ? (
        <>
          <SectionTitle title="Materiaalirivit" />
          {record.lines.map((line) => (
            <AppCard key={line.id} style={styles.lineCard}>
              <View style={styles.lineRow}>
                <Text style={styles.lineText}>
                  {line.productName} × {formatDecimal(line.quantity)} {line.unit}
                </Text>
                <Text style={styles.linePrice}>{formatCurrency(line.lineTotalVat0)}</Text>
              </View>
            </AppCard>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.border,
    marginVertical: 8,
  },
  lineCard: {
    marginBottom: 0,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineText: {
    flex: 1,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  linePrice: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
  },
});
