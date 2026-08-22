import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { AppCard, OutlinedButton, ScreenLoading, SectionTitle } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { removeField, sortedGlobalFields } from '@/src/core/form/formMutations';
import type { FormField } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function FormFieldsScreen() {
  const { ready, formDefinition, formDebug, refreshFormSettings } = useApp();
  const [deleteTarget, setDeleteTarget] = useState<FormField | null>(null);

  if (!ready) return <ScreenLoading />;

  const fields = sortedGlobalFields(formDefinition);

  async function confirmDeleteField() {
    if (!deleteTarget) return;
    const next = removeField(formDefinition, deleteTarget.id);
    await db.saveFormDefinition(next);
    await refreshFormSettings();
    setDeleteTarget(null);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Kentät' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Lomakekentät" />
        <Text style={styles.help}>
          Kentät ovat globaaleja. Valitse mitkä näytetään kussakin sivussa kohdasta Lomakeasetukset →
          Sivut.
        </Text>
        {formDebug.enabled ? (
          <Text style={styles.debugHint}>
            Debug päällä – avaa kenttä ja syötä esimerkkiarvo live-laskentaa varten.
          </Text>
        ) : null}

        <OutlinedButton
          title="Lisää kenttä"
          onPress={() => router.push('/settings/calculation/fields/new' as Href)}
        />

        {fields.length === 0 ? (
          <Text style={styles.empty}>Ei kenttiä</Text>
        ) : (
          fields.map((field) => (
            <AppCard
              key={field.id}
              style={styles.card}
              onPress={() => router.push(`/settings/calculation/fields/${field.id}` as Href)}
            >
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldMeta}>
                {field.key} · {field.type}
                {field.type === 'select' && field.options ? ` · ${field.options.length} valintaa` : ''}
                {field.type === 'computed' ? ' · kaava' : ''}
              </Text>
              {formDebug.enabled && field.debugExampleValue ? (
                <Text style={styles.example}>Esimerkki: {field.debugExampleValue}</Text>
              ) : null}
              <Pressable onPress={() => setDeleteTarget(field)} style={styles.deleteWrap}>
                <Text style={styles.deleteText}>Poista</Text>
              </Pressable>
            </AppCard>
          ))
        )}
      </ScrollView>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Poista kenttä?"
        message={
          deleteTarget
            ? `Poistetaanko kenttä "${deleteTarget.label}"? Se poistuu myös kaikilta sivuilta.`
            : ''
        }
        onClose={() => setDeleteTarget(null)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDeleteTarget(null) },
          {
            title: 'Poista',
            variant: 'destructive',
            onPress: () => {
              void confirmDeleteField();
            },
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 20,
  },
  debugHint: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.accent,
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
  deleteWrap: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  deleteText: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
  },
});
