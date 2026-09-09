import { Text, View } from 'react-native';

import { AppCard, ResultRow, SectionTitle } from '@/src/components/common';
import { sortedPages } from '@/src/core/form/formDefinitionHelpers';
import {
  formatFieldSummaryValue,
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
};

export function FormSummarySection({ form, fieldValues, context, products = [], snapshot }: FormSummarySectionProps) {
  const styles = useThemedStyles(createStyles);
  if (snapshot) {
    if (snapshot.fields.length === 0) return null;

    let lastPageTitle: string | undefined;
    return (
      <>
        <SectionTitle title="Lomaketiedot" />
        <AppCard style={styles.card}>
          {snapshot.fields.map((field) => {
            const pageTitle = field.pageTitle
              ? displayWorkDurationText(field.pageTitle)
              : undefined;
            const showPageTitle = pageTitle && pageTitle !== lastPageTitle;
            if (showPageTitle) lastPageTitle = pageTitle;
            return (
              <View key={field.key}>
                {showPageTitle ? <Text style={styles.pageTitle}>{pageTitle}</Text> : null}
                <ResultRow
                  label={displayWorkDurationText(field.label)}
                  value={displaySnapshotFieldValue(field)}
                />
              </View>
            );
          })}
        </AppCard>
      </>
    );
  }

  if (!form || !fieldValues || !context) return null;

  const fields = summaryDisplayFields(form, fieldValues, context);
  if (fields.length === 0) return null;

  const fieldById = new Map(fields.map((field) => [field.id, field]));
  let lastPageTitle: string | undefined;

  return (
    <>
      <SectionTitle title="Lomaketiedot" />
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
                <View key={field.id}>
                  {showPageTitle ? <Text style={styles.pageTitle}>{pageTitle}</Text> : null}
                  <ResultRow
                    label={displayWorkDurationText(field.label)}
                    value={formatFieldSummaryValue(field, fieldValues, context, products)}
                  />
                </View>
              );
            }),
        )}
      </AppCard>
    </>
  );
}

function displaySnapshotFieldValue(field: FormSnapshotField): string {
  if (!isWorkDurationDaysKey(field.key)) return field.value;
  const numericPart = field.value.replace(/\s*pv\s*$/i, '').trim();
  const parsed = parseNumber(numericPart);
  if (parsed === null) return field.value;
  const days = formatWorkDurationDays(parsed);
  return field.unit ? `${days} ${field.unit}` : days;
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
