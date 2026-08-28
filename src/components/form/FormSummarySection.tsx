import { Text, View } from 'react-native';

import { AppCard, ResultRow, SectionTitle } from '@/src/components/common';
import { sortedPages } from '@/src/core/form/formDefinitionHelpers';
import {
  formatFieldSummaryValue,
  summaryDisplayFields,
} from '@/src/core/form/formSummaryHelpers';
import type { FormDefinition } from '@/src/core/form/types';
import type { FormSnapshot, Product } from '@/src/core/models/types';
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
            const showPageTitle = field.pageTitle && field.pageTitle !== lastPageTitle;
            if (showPageTitle) lastPageTitle = field.pageTitle;
            return (
              <View key={field.key}>
                {showPageTitle ? <Text style={styles.pageTitle}>{field.pageTitle}</Text> : null}
                <ResultRow label={field.label} value={field.value} />
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
              const showPageTitle = page.title !== lastPageTitle;
              if (showPageTitle) lastPageTitle = page.title;
              return (
                <View key={field.id}>
                  {showPageTitle ? <Text style={styles.pageTitle}>{page.title}</Text> : null}
                  <ResultRow
                    label={field.label}
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
