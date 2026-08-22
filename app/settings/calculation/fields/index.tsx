import { router, Stack, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard, ScreenLoading, SectionTitle } from '@/src/components/common';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import { useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

function fieldsByPage(form: FormDefinition): { pageTitle: string; fields: FormField[] }[] {
  const sortedPages = [...form.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  return sortedPages.map((page) => ({
    pageTitle: page.title,
    fields: form.fields
      .filter((field) => field.pageId === page.id && field.type !== 'section')
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export default function FormFieldsScreen() {
  const { ready, formDefinition, formDebug } = useApp();

  if (!ready) return <ScreenLoading />;

  const groups = fieldsByPage(formDefinition);

  return (
    <>
      <Stack.Screen options={{ title: 'Kentät' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Lomakekentät" />
        {formDebug.enabled ? (
          <Text style={styles.debugHint}>
            Debug päällä – avaa kenttä ja syötä esimerkkiarvo live-laskentaa varten.
          </Text>
        ) : null}
        {groups.map((group) => (
          <View key={group.pageTitle} style={styles.group}>
            <Text style={styles.groupTitle}>{group.pageTitle}</Text>
            {group.fields.length === 0 ? (
              <Text style={styles.empty}>Ei kenttiä</Text>
            ) : (
              group.fields.map((field) => (
                <AppCard
                  key={field.id}
                  style={styles.card}
                  onPress={() => router.push(`/settings/calculation/fields/${field.id}` as Href)}
                >
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldMeta}>
                    {field.key} · {field.type}
                    {field.type === 'computed' ? ' · kaava' : ''}
                  </Text>
                  {formDebug.enabled && field.debugExampleValue ? (
                    <Text style={styles.example}>Esimerkki: {field.debugExampleValue}</Text>
                  ) : null}
                </AppCard>
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  debugHint: {
    marginBottom: 12,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.accent,
  },
  group: {
    marginTop: 12,
    gap: 8,
  },
  groupTitle: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
  },
  empty: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
  },
  card: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
    fontSize: 15,
  },
  fieldMeta: {
    marginTop: 4,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
  },
  example: {
    marginTop: 6,
    fontFamily: 'IBMPlexSans_500Medium',
    color: AppColors.accent,
    fontSize: 13,
  },
});
