import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppCard,
  OutlinedButton,
  PrimaryButton,
  ResultRow,
  ScreenLoading,
  ScreenMessage,
  SectionTitle,
} from '@/src/components/common';
import type { CalculationRecord } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import {
  applyVat,
  customerTypeLabel,
  formatDisplayPrice,
  isPrivateCustomer,
  reverseVatLabel,
} from '@/src/core/utils/priceDisplay';
import { formatCurrency, formatDecimal, formatPercent } from '@/src/core/utils/formatters';
import { db } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showAlert } = useThemedAlert();
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

  function notifyCopied() {
    showAlert('Kopioitu', 'Tieto kopioitu leikepöydälle.');
  }

  if (loading) return <ScreenLoading />;
  if (!record) return <ScreenMessage message="Laskelmaa ei löytynyt." />;

  const customer = customerFromRecord(record);
  const privateCustomer = isPrivateCustomer(customer);
  const vatRate = record.vatPercent;
  const displayTotal = formatDisplayPrice(record.totalPriceVat0, record.totalPriceVat, customer);

  return (
    <>
      <Stack.Screen options={{ title: 'Laskelman tiedot' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title={customer.name} />
        <View style={styles.actions}>
          <PrimaryButton
            title="Muokkaa"
            onPress={() => router.push({ pathname: '/wizard', params: { editId: record.id } })}
          />
        </View>

        <AppCard style={styles.card}>
          <ResultRow
            label="Asiakastyyppi"
            value={customerTypeLabel(customer)}
            copyValue={customerTypeLabel(customer)}
            onCopy={notifyCopied}
          />
          {!privateCustomer ? (
            <ResultRow
              label="Käänteinen ALV"
              value={reverseVatLabel(customer)}
              copyValue={reverseVatLabel(customer)}
              onCopy={notifyCopied}
            />
          ) : null}
          <ResultRow
            label="Puh."
            value={customer.phone ?? '–'}
            copyValue={customer.phone}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Sähköposti"
            value={customer.email ?? '–'}
            copyValue={customer.email}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Osoite"
            value={customer.address ?? '–'}
            copyValue={customer.address}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Lisätiedot"
            value={customer.notes ?? '–'}
            copyValue={customer.notes}
            onCopy={notifyCopied}
          />
        </AppCard>

        <AppCard style={styles.card}>
          <ResultRow
            label="Työryhmän kesto (pv)"
            value={formatDecimal(record.workDurationDays)}
            copyValue={formatDecimal(record.workDurationDays)}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Työryhmän koko (hlö)"
            value={`${record.crewSize} hlö`}
            copyValue={`${record.crewSize}`}
            onCopy={notifyCopied}
          />
          <ResultRow
            label={privateCustomer ? 'Tuntihinta (alv)' : 'Tuntihinta (alv0)'}
            value={formatDisplayPrice(
              record.hourlyRate,
              applyVat(record.hourlyRate, vatRate),
              customer,
            )}
            copyValue={String(record.hourlyRate)}
            onCopy={notifyCopied}
          />
          <ResultRow
            label={privateCustomer ? 'Urakkahinta (alv)' : 'Urakkahinta (alv0)'}
            value={formatDisplayPrice(
              record.contractPriceVat0,
              applyVat(record.contractPriceVat0, vatRate),
              customer,
            )}
            copyValue={String(record.contractPriceVat0)}
            onCopy={notifyCopied}
          />
          <ResultRow
            label={privateCustomer ? 'Materiaalit (alv)' : 'Materiaalit (alv0)'}
            value={formatDisplayPrice(
              record.materialsVat0,
              applyVat(record.materialsVat0, vatRate),
              customer,
            )}
            copyValue={String(record.materialsVat0)}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Myyntikate (€)"
            value={formatDisplayPrice(
              record.marginEur,
              applyVat(record.marginEur, vatRate),
              customer,
            )}
            copyValue={String(record.marginEur)}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Myyntikate (%)"
            value={formatPercent(record.marginPercent)}
            copyValue={String(record.marginPercent)}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Myyntipalkkio (€)"
            value={formatDisplayPrice(
              record.commissionEur,
              applyVat(record.commissionEur, vatRate),
              customer,
            )}
            copyValue={String(record.commissionEur)}
            onCopy={notifyCopied}
          />
          <ResultRow
            label="Myyntipalkkio (%)"
            value={formatPercent(record.commissionPercent)}
            copyValue={String(record.commissionPercent)}
            onCopy={notifyCopied}
          />
          <View style={styles.divider} />
          {privateCustomer ? (
            <>
              <ResultRow
                label="Kokonaishinta (alv0)"
                value={formatCurrency(record.totalPriceVat0)}
                copyValue={String(record.totalPriceVat0)}
                onCopy={notifyCopied}
              />
              <ResultRow
                label={`ALV (${formatPercent(vatRate)})`}
                value={formatCurrency(record.vatAmount)}
                copyValue={String(record.vatAmount)}
                onCopy={notifyCopied}
              />
              <ResultRow
                label="Kokonaishinta (alv)"
                value={formatCurrency(record.totalPriceVat)}
                copyValue={String(record.totalPriceVat)}
                onCopy={notifyCopied}
                highlight
              />
            </>
          ) : (
            <>
              <ResultRow
                label="Kokonaishinta (alv0)"
                value={formatCurrency(record.totalPriceVat0)}
                copyValue={String(record.totalPriceVat0)}
                onCopy={notifyCopied}
                highlight
              />
              {customer.reverseVat ? (
                <ResultRow
                  label="ALV"
                  value="Käänteinen ALV"
                  copyValue="Käänteinen ALV"
                  onCopy={notifyCopied}
                />
              ) : (
                <>
                  <ResultRow
                    label="ALV"
                    value={formatCurrency(record.vatAmount)}
                    copyValue={String(record.vatAmount)}
                    onCopy={notifyCopied}
                  />
                  <ResultRow
                    label="Kokonaishinta (alv)"
                    value={formatCurrency(record.totalPriceVat)}
                    copyValue={String(record.totalPriceVat)}
                    onCopy={notifyCopied}
                  />
                </>
              )}
            </>
          )}
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
                  <Text style={styles.linePrice}>
                    {formatDisplayPrice(
                      line.lineTotalVat0,
                      applyVat(line.lineTotalVat0, vatRate),
                      customer,
                    )}
                  </Text>
                </View>
              </AppCard>
            ))}
          </>
        ) : null}

        <OutlinedButton title="Takaisin historiaan" onPress={() => router.back()} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  actions: {
    marginTop: 8,
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
