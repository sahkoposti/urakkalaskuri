import { View } from 'react-native';

import { AppCard, ResultRow } from '@/src/components/common';
import type { CustomerInfo, FormSnapshot } from '@/src/core/models/types';
import { cardShownTotals } from '@/src/core/pdf/buildPdfContext';
import {
  labeledWithVatMode,
  priceBreakdownParts,
  reconcilePriceRows,
  summaryShowsVatInclusive,
  vat0Tag,
  vatInclTag,
  type PriceBreakdownValues,
} from '@/src/core/utils/priceDisplay';
import { formatCurrency, formatPercent, roundToCents } from '@/src/core/utils/formatters';
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
  /** Yrityksen ruutuyhteenveto lukee tästä `businessVatMode`. Puuttuva = ALV 0. */
  snapshot?: Pick<FormSnapshot, 'businessVatMode'> | null;
  includeVat?: boolean;
  /** Jo säävarauksen sisältävä kokonaisluku; ei kerrota uudelleen. */
  displayedWorkDurationDays?: number;
  showDuration?: boolean;
};

export function PriceBreakdownCard({
  values,
  customer,
  lines,
  snapshot,
  includeVat: includeVatProp,
  displayedWorkDurationDays,
  showDuration = false,
}: PriceBreakdownCardProps) {
  const styles = useThemedStyles(createStyles);
  const includeVat = includeVatProp ?? summaryShowsVatInclusive(customer, lines, snapshot);
  const parts = priceBreakdownParts(values, includeVat);
  const shown = cardShownTotals(values, customer);
  const target = roundToCents(includeVat ? shown.totalPriceVat : shown.totalPriceVat0);
  const rows = reconcilePriceRows(
    parts.materials,
    parts.work,
    parts.showDiscount ? parts.discountAmount : 0,
    target,
  );
  const durationText = formatDurationDisplayValue(displayedWorkDurationDays);

  return (
    <AppCard style={styles.card}>
      {showDuration && durationText ? (
        <ResultRow label={WORK_DURATION_DISPLAY_LABEL} value={durationText} />
      ) : null}
      <ResultRow
        label={labeledWithVatMode('Materiaalit', includeVat, parts.vatRate)}
        value={formatCurrency(rows.materials)}
      />
      <ResultRow
        label={labeledWithVatMode('Työ', includeVat, parts.vatRate)}
        value={formatCurrency(rows.work)}
      />
      {parts.showDiscount ? (
        <>
          <View style={styles.divider} />
          <ResultRow
            label={`Alennus (${formatPercent(values.discountPercent)})`}
            value={`−${formatCurrency(rows.discount)}`}
          />
        </>
      ) : null}
      <View style={styles.divider} />
      <ResultRow
        label={`Kokonaishinta (${vat0Tag()})`}
        value={formatCurrency(shown.totalPriceVat0)}
        highlight={!includeVat}
      />
      {includeVat ? (
        <>
          {customer.reverseVat ? (
            <ResultRow label="ALV" value="Käänteinen ALV" />
          ) : (
            <ResultRow
              label={`ALV (${formatPercent(parts.vatRate)})`}
              value={formatCurrency(shown.vatAmount)}
            />
          )}
          <ResultRow
            label={`Kokonaishinta (${vatInclTag(parts.vatRate)})`}
            value={formatCurrency(shown.totalPriceVat)}
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
