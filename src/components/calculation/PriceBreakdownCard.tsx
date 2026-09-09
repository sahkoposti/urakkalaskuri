import { View } from 'react-native';

import { AppCard, ResultRow } from '@/src/components/common';
import type { CustomerInfo } from '@/src/core/models/types';
import {
  amountInVatMode,
  customerSeesVatInclusive,
  labeledWithVatMode,
  vat0Tag,
  vatInclTag,
  workPriceVat0,
} from '@/src/core/utils/priceDisplay';
import { formatCurrency, formatPercent, formatWorkDurationDays } from '@/src/core/utils/formatters';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export type PriceBreakdownValues = {
  materialsVat0: number;
  discountPercent: number;
  totalPriceVat0: number;
  totalPriceVat: number;
  vatAmount: number;
  vatPercent: number;
  totalPriceVatBeforeDiscount: number;
  totalPriceVat0BeforeDiscount: number;
  workDurationDays?: number;
};

type PriceBreakdownCardProps = {
  values: PriceBreakdownValues;
  customer: CustomerInfo;
  weatherReserveFactor?: number;
  showDuration?: boolean;
};

export function PriceBreakdownCard({
  values,
  customer,
  weatherReserveFactor = 1,
  showDuration = false,
}: PriceBreakdownCardProps) {
  const styles = useThemedStyles(createStyles);
  const vatRate = values.vatPercent;
  const includeVat = customerSeesVatInclusive(customer);
  const workVat0 = workPriceVat0(values.totalPriceVat0, values.materialsVat0);
  const priceBeforeDiscount = includeVat
    ? (values.totalPriceVatBeforeDiscount ?? values.totalPriceVat)
    : (values.totalPriceVat0BeforeDiscount ?? values.totalPriceVat0);
  const priceAfterDiscount = includeVat ? values.totalPriceVat : values.totalPriceVat0;
  const discountAmount = Math.max(0, priceBeforeDiscount - priceAfterDiscount);
  const showDiscount = values.discountPercent > 0 && discountAmount > 0;

  return (
    <AppCard style={styles.card}>
      {showDuration && values.workDurationDays != null ? (
        <ResultRow
          label="Työn arvioitu kesto (pv)"
          value={formatWorkDurationDays(values.workDurationDays, weatherReserveFactor)}
        />
      ) : null}
      <ResultRow
        label={labeledWithVatMode('Materiaalit', includeVat, vatRate)}
        value={formatCurrency(amountInVatMode(values.materialsVat0, includeVat, vatRate))}
      />
      <ResultRow
        label={labeledWithVatMode('Työ', includeVat, vatRate)}
        value={formatCurrency(amountInVatMode(workVat0, includeVat, vatRate))}
      />
      {showDiscount ? (
        <>
          <View style={styles.divider} />
          <ResultRow
            label={`Alennus (${formatPercent(values.discountPercent)})`}
            value={`−${formatCurrency(discountAmount)}`}
          />
        </>
      ) : null}
      <View style={styles.divider} />
      <ResultRow
        label={`Kokonaishinta (${vat0Tag()})`}
        value={formatCurrency(values.totalPriceVat0)}
        highlight={!includeVat}
      />
      {customer.reverseVat ? (
        <ResultRow label="ALV" value="Käänteinen ALV" />
      ) : (
        <ResultRow
          label={`ALV (${formatPercent(vatRate)})`}
          value={formatCurrency(values.vatAmount)}
        />
      )}
      <ResultRow
        label={`Kokonaishinta (${vatInclTag(vatRate)})`}
        value={formatCurrency(values.totalPriceVat)}
        highlight={includeVat}
      />
    </AppCard>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    card: {
      marginTop: 8,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 8,
    },
  };
}
