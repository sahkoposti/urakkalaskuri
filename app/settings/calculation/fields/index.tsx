import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { AppCard, OutlinedButton, ScreenLoading, SectionTitle } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  FIELD_TYPE_LABELS,
  removeField,
  sortedSystemFields,
  sortedUserFields,
} from '@/src/core/form/formMutations';
import type { FormField } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

function FieldCard({
  field,
  formDebugEnabled,
  deletable,
  onPress,
  onDelete,
}: {
  field: FormField;
  formDebugEnabled: boolean;
  deletable: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  return (
    <AppCard key={field.id} style={styles.card} onPress={onPress}>
      <Text style={styles.fieldLabel}>{field.label}</Text>
      <Text style={styles.fieldMeta}>
        {field.key} · {FIELD_TYPE_LABELS[field.type]}
        {field.type === 'select' && field.options ? ` · ${field.options.length} valintaa` : ''}
        {field.type === 'computed' ? (field.systemKey ? ' · järjestelmäkaava' : ' · kaava') : ''}
      </Text>
      {field.type === 'computed' && field.formula ? (
        <Text style={styles.formula} numberOfLines={2}>
          {field.formula}
        </Text>
      ) : null}
      {formDebugEnabled && field.debugExampleValue ? (
        <Text style={styles.example}>Esimerkki: {field.debugExampleValue}</Text>
      ) : null}
      {deletable && onDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteWrap}>
          <Text style={styles.deleteText}>Poista</Text>
        </Pressable>
      ) : null}
    </AppCard>
  );
}

export default function FormFieldsScreen() {
  const { ready, formDefinition, formDebug, refreshFormSettings } = useApp();
  const [deleteTarget, setDeleteTarget] = useState<FormField | null>(null);

  if (!ready) return <ScreenLoading />;

  const userFields = sortedUserFields(formDefinition);
  const systemFields = sortedSystemFields(formDefinition);

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
        <SectionTitle title="Omat kentät" />
        <Text style={styles.help}>
          Kentät ovat globaaleja. Valitse mitkä näytetään kussakin sivussa kohdasta Lomakeasetukset →
          Sivut. Jokainen kenttä voi olla vain yhdellä sivulla kerrallaan.
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

        {userFields.length === 0 ? (
          <Text style={styles.empty}>Ei omia kenttiä</Text>
        ) : (
          userFields.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              formDebugEnabled={formDebug.enabled}
              deletable
              onPress={() => router.push(`/settings/calculation/fields/${field.id}` as Href)}
              onDelete={() => setDeleteTarget(field)}
            />
          ))
        )}

        <SectionTitle title="Järjestelmäkentät" />
        <Text style={styles.help}>
          Laskennan tulokset (kesto, hinnat, ALV). Nämä kaavat ajavat wizardin hintaa. Voit muokata
          näyttönimeä ja kaavaa; oletusarvot saa palautettua editorissa.
        </Text>

        {systemFields.length === 0 ? (
          <Text style={styles.empty}>Ei järjestelmäkenttiä</Text>
        ) : (
          systemFields.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              formDebugEnabled={formDebug.enabled}
              deletable={false}
              onPress={() => router.push(`/settings/calculation/fields/${field.id}` as Href)}
            />
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
    gap: 8,
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
    padding: 12,
  },
  fieldLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
    fontSize: 15,
  },
  fieldMeta: {
    marginTop: 2,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
  },
  formula: {
    marginTop: 4,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  example: {
    marginTop: 4,
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
