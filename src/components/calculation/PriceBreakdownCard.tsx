import { View } from 'react-native';

import { AppCard, ResultRow } from '@/src/components/common';
import type { CustomerInfo } from '@/src/core/models/types';
import {
  labeledWithVatMode,
  priceBreakdownParts,
  summaryShowsVatInclusive,
  vat0Tag,
  vatInclTag,
  type PriceBreakdownValues,
} from '@/src/core/utils/priceDisplay';
import { formatCurrency, formatPercent } from '@/src/core/utils/formatters';
import {
  formatDurationDisplayValue,
  WORK_DURATION_DISPLAY_LABEL,
} from '@/src/core/structure/workDurationDisplay';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export type { PriceBreakdownValues };

type PriceBreakdownCardProps = {
  values: PriceBreakdownValues;
  customer: CustomerInfo;
  lines?: Array<{ pricesIncludeVat?: boolean }>;
  includeVat?: boolean;
  /** Jo säävarauksen sisältävä kokonaisluku; ei kerrota uudelleen. */
  displayedWorkDurationDays?: number;
  showDuration?: boolean;
};

export function PriceBreakdownCard({
  values,
  customer,
  lines,
  includeVat: includeVatProp,
  displayedWorkDurationDays,
  showDuration = false,
}: PriceBreakdownCardProps) {
  const styles = useThemedStyles(createStyles);
  const includeVat = includeVatProp ?? summaryShowsVatInclusive(customer, lines);
  const parts = priceBreakdownParts(values, includeVat);
  const durationText = formatDurationDisplayValue(displayedWorkDurationDays);

  return (
    <AppCard style={styles.card}>
      {showDuration && durationText ? (
        <ResultRow label={WORK_DURATION_DISPLAY_LABEL} value={durationText} />
      ) : null}
      <ResultRow
        label={labeledWithVatMode('Materiaalit', includeVat, parts.vatRate)}
        value={formatCurrency(parts.materials)}
      />
      <ResultRow
        label={labeledWithVatMode('Työ', includeVat, parts.vatRate)}
        value={formatCurrency(parts.work)}
      />
      {parts.showDiscount ? (
        <>
          <View style={styles.divider} />
          <ResultRow
            label={`Alennus (${formatPercent(values.discountPercent)})`}
            value={`−${formatCurrency(parts.discountAmount)}`}
          />
        </>
      ) : null}
      <View style={styles.divider} />
      <ResultRow
        label={`Kokonaishinta (${vat0Tag()})`}
        value={formatCurrency(values.totalPriceVat0)}
        highlight={!includeVat}
      />
      {includeVat ? (
        <>
          {customer.reverseVat ? (
            <ResultRow label="ALV" value="Käänteinen ALV" />
          ) : (
            <ResultRow
              label={`ALV (${formatPercent(parts.vatRate)})`}
              value={formatCurrency(values.vatAmount)}
            />
          )}
          <ResultRow
            label={`Kokonaishinta (${vatInclTag(parts.vatRate)})`}
            value={formatCurrency(values.totalPriceVat)}
            highlight
          />
        </>
      ) : customer.reverseVat ? (
        <ResultRow label="ALV" value="Käänteinen ALV" />
      ) : null}
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
