import { Text, View } from 'react-native';

import { AppCard, ResultRow, SectionTitle } from '@/src/components/common';
import { sortedPages } from '@/src/core/form/formDefinitionHelpers';
import {
  formatFieldSummaryValue,
  lineFormSnapshot,
  summaryDisplayFields,
} from '@/src/core/form/formSummaryHelpers';
import type { FormDefinition } from '@/src/core/form/types';
import type { FormSnapshot, FormSnapshotField, Product } from '@/src/core/models/types';
import {
  displayWorkDurationText,
  formatWorkDurationDays,
  isWorkDurationDaysKey,
  parseNumber,
} from '@/src/core/utils/formatters';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type FormSummarySectionProps = {
  form?: FormDefinition;
  fieldValues?: Record<string, string>;
  context?: Record<string, number>;
  products?: Product[];
  snapshot?: FormSnapshot;
  workDurationDays?: number;
  weatherReserveFactor?: number;
  title?: string;
  fieldKeyPrefix?: string;
};

export function FormSummarySection({
  form,
  fieldValues,
  context,
  products = [],
  snapshot,
  workDurationDays,
  weatherReserveFactor = 1,
  title = 'Lomaketiedot',
  fieldKeyPrefix = '',
}: FormSummarySectionProps) {
  const styles = useThemedStyles(createStyles);
  const resolvedSnapshot =
    snapshot && snapshot.fields.length > 0
      ? snapshot
      : form && fieldValues
        ? lineFormSnapshot({ snapshot, fieldValues }, form, products, context ?? {})
        : undefined;

  if (resolvedSnapshot && resolvedSnapshot.fields.length > 0) {
    let lastPageTitle: string | undefined;
    return (
      <>
        <SectionTitle title={title} />
        <AppCard style={styles.card}>
          {resolvedSnapshot.fields.map((field, index) => {
            const pageTitle = field.pageTitle
              ? displayWorkDurationText(field.pageTitle)
              : undefined;
            const showPageTitle = pageTitle && pageTitle !== lastPageTitle;
            if (showPageTitle) lastPageTitle = pageTitle;
            return (
              <View key={`${fieldKeyPrefix}${field.key}:${index}`}>
                {showPageTitle ? <Text style={styles.pageTitle}>{pageTitle}</Text> : null}
                <ResultRow
                  label={displayWorkDurationText(field.label)}
                  value={displaySnapshotFieldValue(field, workDurationDays, weatherReserveFactor)}
                />
              </View>
            );
          })}
        </AppCard>
      </>
    );
  }

  if (!form || !fieldValues) return null;

  const fields = summaryDisplayFields(form, fieldValues, context);
  if (fields.length === 0) return null;

  const fieldById = new Map(fields.map((field) => [field.id, field]));
  let lastPageTitle: string | undefined;

  return (
    <>
      <SectionTitle title={title} />
      <AppCard style={styles.card}>
        {sortedPages(form).flatMap((page) =>
          (page.fieldIds ?? [])
            .map((fieldId) => fieldById.get(fieldId))
            .filter((field): field is NonNullable<typeof field> => field !== undefined)
            .map((field) => {
              const pageTitle = displayWorkDurationText(page.title);
              const showPageTitle = pageTitle !== lastPageTitle;
              if (showPageTitle) lastPageTitle = pageTitle;
              return (
                <View key={`${fieldKeyPrefix}${field.id}`}>
                  {showPageTitle ? <Text style={styles.pageTitle}>{pageTitle}</Text> : null}
                  <ResultRow
                    label={displayWorkDurationText(field.label)}
                    value={formatFieldSummaryValue(field, fieldValues, context ?? {}, products)}
                  />
                </View>
              );
            }),
        )}
      </AppCard>
    </>
  );
}

function displaySnapshotFieldValue(
  field: FormSnapshotField,
  workDurationDays?: number,
  weatherReserveFactor = 1,
): string {
  if (!isWorkDurationDaysKey(field.key)) return field.value;
  const days =
    workDurationDays !== undefined && Number.isFinite(workDurationDays)
      ? workDurationDays
      : parseNumber(field.value.replace(/\s*pv\s*$/i, '').trim());
  if (days === null) return field.value;
  const formatted = formatWorkDurationDays(days, weatherReserveFactor);
  return field.unit ? `${formatted} ${field.unit}` : formatted;
}

function createStyles(colors: AppColorPalette) {
  return {
    card: {
      marginTop: 8,
    },
    pageTitle: {
      marginTop: 8,
      marginBottom: 4,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
      fontSize: 13,
    },
  };
}
