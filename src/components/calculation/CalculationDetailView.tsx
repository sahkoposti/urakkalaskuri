import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { FormSummarySection } from '@/src/components/form/FormSummarySection';
import { ThemedIcon } from '@/src/components/ThemedIcon';
import { PriceBreakdownCard } from '@/src/components/calculation/PriceBreakdownCard';
import {
  AppCard,
  OutlinedButton,
  PrimaryButton,
  ResultRow,
  SectionTitle,
} from '@/src/components/common';
import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import { buildCalculationFormulaContext, formatTravelTimeHoursOneWay } from '@/src/core/form/calculationFormulaContext';
import { lineFormSnapshot } from '@/src/core/form/formSummaryHelpers';
import {
  formVersionMismatchMessage,
  hasFormVersionMismatch,
} from '@/src/core/form/formVersion';
import type { FormDefinition } from '@/src/core/form/types';
import type { CalculationRecord, CustomerInfo, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import {
  lineListPriceVat0,
  lineTotalVat0,
  withDerivedLinePricing,
} from '@/src/core/structure/linePricing';
import { estimateWorkDurationDays } from '@/src/core/utils/formatters';
import { resolveDisplayedWorkDurationDays } from '@/src/core/structure/workDurationDisplay';
import { applyVat, isPrivateCustomer, reverseVatLabel } from '@/src/core/utils/priceDisplay';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
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

function lineBreakdown(line: StructureLine, reverseVat: boolean) {
  const priced = withDerivedLinePricing(line);
  const total = lineTotalVat0(priced);
  const list = lineListPriceVat0(priced);
  const vatAmount = reverseVat ? 0 : applyVat(total, priced.vatPercent) - total;
  return {
    materialsVat0: priced.materialsVat0,
    discountPercent: priced.discountPercent,
    totalPriceVat0: total,
    totalPriceVat: reverseVat ? total : total + vatAmount,
    vatAmount,
    vatPercent: priced.vatPercent,
    totalPriceVatBeforeDiscount: reverseVat ? list : applyVat(list, priced.vatPercent),
    totalPriceVat0BeforeDiscount: list,
  };
}

export function CalculationDetailView({
  record,
  formDefinition,
  onCopy,
  onFooterPress,
  onDeletePress,
}: CalculationDetailViewProps) {
  const styles = useThemedStyles(createStyles);
  const { settings, structures } = useApp();
  const customer = customerFromRecord(record);
  const privateCustomer = isPrivateCustomer(customer);
  const structureLines = ensureStructureLines(record);
  const showStructureSummaries = structureLines.length > 1;
  const singleLine = structureLines.length === 1 ? structureLines[0] : undefined;
  const totalDisplayedDuration = singleLine
    ? resolveDisplayedWorkDurationDays(singleLine, settings.weatherReserveFactor)
    : estimateWorkDurationDays(record.workDurationDays, settings.weatherReserveFactor);
  const mismatchLine = structureLines.find((line) => {
    const structure = structures.find((item) => item.id === line.structureId);
    const snapshotVersion = line.formVersion ?? line.snapshot?.formVersion;
    const currentVersion = structure?.form.version ?? formDefinition.version;
    return hasFormVersionMismatch(snapshotVersion, currentVersion);
  });
  const snapshotVersion =
    mismatchLine?.formVersion ?? mismatchLine?.snapshot?.formVersion ?? record.formSnapshot?.formVersion;
  const currentVersion = formDefinition.version;

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

      {mismatchLine && snapshotVersion != null ? (
        <View style={styles.versionWarning}>
          <Text style={styles.versionWarningTitle}>Lomakepohja on muuttunut</Text>
          <Text style={styles.versionWarningText}>
            {formVersionMismatchMessage(snapshotVersion, currentVersion)}
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
          <ResultRow label="Käänteinen ALV" value={reverseVatLabel(customer)} />
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

      {record.deliveryScheduleText?.trim() || record.travelTimeHoursOneWay ? (
        <AppCard style={styles.card}>
          {record.deliveryScheduleText?.trim() ? (
            <ResultRow label="Toimitusajankohta" value={record.deliveryScheduleText.trim()} />
          ) : null}
          {record.travelTimeHoursOneWay ? (
            <ResultRow
              label="Matka-aika yhteen suuntaan"
              value={`${formatTravelTimeHoursOneWay(record.travelTimeHoursOneWay)} h`}
            />
          ) : null}
        </AppCard>
      ) : null}

      <PriceBreakdownCard
        values={record}
        customer={customer}
        displayedWorkDurationDays={totalDisplayedDuration}
        showDuration={structureLines.length <= 1}
      />

      {structureLines.map((line) => (
        <LineDetail
          key={line.id}
          line={line}
          customer={customer}
          weatherReserveFactor={settings.weatherReserveFactor}
          showPriceSummary={showStructureSummaries}
          travelTimeHoursOneWay={record.travelTimeHoursOneWay}
        />
      ))}

      <OutlinedButton title="Sulje" onPress={onFooterPress} />
    </ScrollView>
  );
}

function LineDetail({
  line,
  customer,
  weatherReserveFactor,
  showPriceSummary,
  travelTimeHoursOneWay,
}: {
  line: StructureLine;
  customer: CustomerInfo;
  weatherReserveFactor: number;
  showPriceSummary: boolean;
  travelTimeHoursOneWay?: number;
}) {
  const { products, structures, settings } = useApp();
  const reverseVat = Boolean(customer.reverseVat);
  const structure = structures.find((item) => item.id === line.structureId);
  const structureProducts = products.filter((product) =>
    productBelongsToStructure(product, line.structureId),
  );
  const context = structure
    ? previewFormContext(
        structure.form,
        line.fieldValues ?? {},
        [],
        structureProducts,
        settingsForStructure(settings, structure),
        undefined,
        reverseVat,
        buildCalculationFormulaContext({ travelTimeHoursOneWay }),
      )
    : undefined;
  const snapshot = lineFormSnapshot(line, structure?.form, structureProducts, context);
  const displayedWorkDurationDays = resolveDisplayedWorkDurationDays(
    line,
    weatherReserveFactor,
  );

  return (
    <View>
      {showPriceSummary ? <SectionTitle title={line.name} /> : null}
      {showPriceSummary ? (
        <PriceBreakdownCard
          values={lineBreakdown(line, reverseVat)}
          customer={customer}
          displayedWorkDurationDays={displayedWorkDurationDays}
          showDuration
        />
      ) : null}
      {line.additionalInfo?.trim() ? (
        <AppCard>
          <ResultRow label="Lisätiedot" value={line.additionalInfo.trim()} />
        </AppCard>
      ) : null}
      <FormSummarySection
        form={structure?.form}
        fieldValues={line.fieldValues}
        context={context}
        products={structureProducts}
        snapshot={snapshot}
        workDurationDays={line.workDurationDays}
        weatherReserveFactor={weatherReserveFactor}
        fieldKeyPrefix={`${line.id}:`}
      />
    </View>
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
  };
}
