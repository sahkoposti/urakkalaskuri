import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { FormSummarySection } from '@/src/components/form/FormSummarySection';
import { ThemedIcon } from '@/src/components/ThemedIcon';
import {
  AppCard,
  OutlinedButton,
  PrimaryButton,
  ResultRow,
  SectionTitle,
} from '@/src/components/common';
import {
  formVersionMismatchFromRecord,
  formVersionMismatchMessage,
} from '@/src/core/form/formVersion';
import type { FormDefinition } from '@/src/core/form/types';
import type { CalculationRecord } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import {
  formatContractPriceVat0,
  formatMarginCommissionPrice,
  formatMaterialsPrice,
  applyVat,
  isPrivateCustomer,
  reverseVatLabel,
} from '@/src/core/utils/priceDisplay';
import { formatCurrency, formatDecimal, formatPercent, formatWorkDurationDays } from '@/src/core/utils/formatters';
import { useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type CalculationDetailViewProps = {
  record: CalculationRecord;
  formDefinition: FormDefinition;
  onCopy?: () => void;
  onFooterPress: () => void;
  onDeletePress?: () => void;
};

export function CalculationDetailView({
  record,
  formDefinition,
  onCopy,
  onFooterPress,
  onDeletePress,
}: CalculationDetailViewProps) {
  const styles = useThemedStyles(createStyles);
  const { settings } = useApp();
  const customer = customerFromRecord(record);
  const privateCustomer = isPrivateCustomer(customer);
  const vatRate = record.vatPercent;
  const formVersionMismatch = formVersionMismatchFromRecord(record, formDefinition);
  const snapshotVersion = record.formSnapshot?.formVersion;
  const priceBeforeDiscount = privateCustomer
    ? (record.totalPriceVatBeforeDiscount ?? record.totalPriceVat)
    : (record.totalPriceVat0BeforeDiscount ?? record.totalPriceVat0);
  const priceAfterDiscount = privateCustomer ? record.totalPriceVat : record.totalPriceVat0;
  const discountAmount = Math.max(0, priceBeforeDiscount - priceAfterDiscount);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.customerName}>{customer.name}</Text>
          {onDeletePress ? (
            <Pressable
              onPress={onDeletePress}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
              accessibilityLabel="Poista laskelma"
              hitSlop={8}
            >
              <ThemedIcon name="trash" size={24} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.titleUnderline} />
      </View>

      {formVersionMismatch && snapshotVersion != null ? (
        <View style={styles.versionWarning}>
          <Text style={styles.versionWarningTitle}>Lomakepohja on muuttunut</Text>
          <Text style={styles.versionWarningText}>
            {formVersionMismatchMessage(snapshotVersion, formDefinition.version)}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          title="Muokkaa"
          onPress={() => router.push({ pathname: '/wizard', params: { editId: record.id } })}
        />
      </View>

      <AppCard style={styles.card}>
        {!privateCustomer ? (
          <ResultRow
            label="Käänteinen ALV"
            value={reverseVatLabel(customer)}
          />
        ) : null}
        <ResultRow
          label="Puh."
          value={customer.phone ?? '–'}
          copyValue={customer.phone}
          onCopy={onCopy}
        />
        <ResultRow
          label="Sähköposti"
          value={customer.email ?? '–'}
          copyValue={customer.email}
          onCopy={onCopy}
        />
        <ResultRow
          label="Osoite"
          value={customer.address ?? '–'}
          copyValue={customer.address}
          onCopy={onCopy}
        />
        <ResultRow
          label="Postinumero"
          value={customer.postalCode ?? '–'}
          copyValue={customer.postalCode}
          onCopy={onCopy}
        />
        <ResultRow
          label="Postitoimipaikka"
          value={customer.postalLocality ?? '–'}
          copyValue={customer.postalLocality}
          onCopy={onCopy}
        />
        <ResultRow
          label="Lisätiedot"
          value={customer.notes ?? '–'}
          copyValue={customer.notes}
          onCopy={onCopy}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <ResultRow
          label="Työn arvioitu kesto (pv)"
          value={formatWorkDurationDays(record.workDurationDays, settings.weatherReserveFactor)}
        />
        <ResultRow
          label="Urakkahinta (alv0)"
          value={formatContractPriceVat0(record.contractPriceVat0)}
        />
        <ResultRow
          label="Materiaalit (alv0)"
          value={formatCurrency(record.materialsVat0)}
        />
        {!customer.reverseVat ? (
          <ResultRow
            label="Materiaalit (sis. ALV)"
            value={formatCurrency(applyVat(record.materialsVat0, vatRate))}
          />
        ) : null}
        <ResultRow
          label="Myyntikate"
          value={formatMarginCommissionPrice(record.marginEur)}
        />
        <ResultRow
          label="Myyntikate (%)"
          value={formatPercent(record.marginPercent)}
        />
        <ResultRow
          label="Myyntipalkkio"
          value={formatMarginCommissionPrice(record.commissionEur)}
        />
        {record.discountPercent > 0 ? (
          <>
            <View style={styles.divider} />
            <ResultRow
              label="Hinta ennen alennusta"
              value={formatCurrency(priceBeforeDiscount)}
            />
            <ResultRow
              label={`Alennus (${formatPercent(record.discountPercent)})`}
              value={`−${formatCurrency(discountAmount)}`}
            />
          </>
        ) : null}
        <View style={styles.divider} />
        {privateCustomer ? (
          <>
            <ResultRow
              label="Kokonaishinta (alv0)"
              value={formatCurrency(record.totalPriceVat0)}
            />
            <ResultRow
              label={`ALV (${formatPercent(vatRate)})`}
              value={formatCurrency(record.vatAmount)}
            />
            <ResultRow
              label="Kokonaishinta (alv)"
              value={formatCurrency(record.totalPriceVat)}
              highlight
            />
          </>
        ) : (
          <>
            <ResultRow
              label="Kokonaishinta (alv0)"
              value={formatCurrency(record.totalPriceVat0)}
              highlight
            />
            {customer.reverseVat ? (
              <ResultRow label="ALV" value="Käänteinen ALV" />
            ) : (
              <>
                <ResultRow
                  label="ALV"
                  value={formatCurrency(record.vatAmount)}
                />
                <ResultRow
                  label="Kokonaishinta (alv)"
                  value={formatCurrency(record.totalPriceVat)}
                />
              </>
            )}
          </>
        )}
      </AppCard>

      <FormSummarySection
        snapshot={record.formSnapshot}
        workDurationDays={record.workDurationDays}
        weatherReserveFactor={settings.weatherReserveFactor}
      />

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
                  {formatMaterialsPrice(line.lineTotalVat0, customer, vatRate)}
                </Text>
              </View>
            </AppCard>
          ))}
        </>
      ) : null}

      <OutlinedButton title="Sulje" onPress={onFooterPress} />
    </ScrollView>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 12,
    },
    titleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    customerName: {
      flex: 1,
      fontSize: 24,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    titleUnderline: {
      marginTop: 8,
      width: 40,
      height: 3,
      backgroundColor: colors.accent,
    },
    deleteButton: {
      padding: 4,
    },
    deleteButtonPressed: {
      opacity: 0.7,
    },
    versionWarning: {
      padding: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      backgroundColor: colors.surface,
      gap: 6,
    },
    versionWarningTitle: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 15,
      color: colors.accent,
    },
    versionWarningText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
    },
    actions: {
      marginTop: 8,
    },
    card: {
      marginTop: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
    lineCard: {
      marginBottom: 0,
    },
    lineRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    lineText: {
      flex: 1,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    linePrice: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
    },
  };
}
