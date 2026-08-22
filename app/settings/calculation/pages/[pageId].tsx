import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppCard, OutlinedButton, PrimaryButton, ScreenLoading, ScreenMessage } from '@/src/components/common';
import {
  addFieldToPage,
  fieldsAvailableForPage,
  fieldsForPage,
  FIELD_TYPE_LABELS,
  formsEqual,
  moveFieldOnPage,
  removeFieldFromPage,
  sortedPages,
} from '@/src/core/form/formMutations';
import type { FormDefinition } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import { AppColors } from '@/src/theme/colors';

export default function PageFieldsSettingsScreen() {
  const { pageId } = useLocalSearchParams<{ pageId: string }>();
  const { ready, formDefinition, refreshFormSettings } = useApp();
  const [draft, setDraft] = useState<FormDefinition>(formDefinition);

  useEffect(() => {
    setDraft(formDefinition);
  }, [formDefinition]);

  const page = sortedPages(draft).find((item) => item.id === pageId);
  const isDirty = useMemo(() => !formsEqual(draft, formDefinition), [draft, formDefinition]);

  async function persistSettings(): Promise<boolean> {
    await db.saveFormDefinition(draft);
    await refreshFormSettings();
    return true;
  }

  const { exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!ready) return <ScreenLoading />;
  if (!page) return <ScreenMessage message="Sivua ei löytynyt." />;

  const assigned = fieldsForPage(draft, page.id);
  const available = fieldsAvailableForPage(draft, page.id);

  async function handleSave() {
    await save();
  }

  return (
    <>
      <Stack.Screen options={{ title: `${page.title} – kentät` }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Valitse mitkä kentät näytetään tällä sivulla. Jokainen kenttä voi olla vain yhdellä
          sivulla kerrallaan. Laskenta-kenttä näytetään lomakkeella muokattavana arvona.
        </Text>

        <Text style={styles.sectionTitle}>Sivulla ({assigned.length})</Text>
        {assigned.length === 0 ? (
          <Text style={styles.empty}>Ei kenttiä tällä sivulla</Text>
        ) : (
          assigned.map((field, index) => (
            <View key={field.id} style={styles.row}>
              <AppCard style={styles.card}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldMeta}>
                  {FIELD_TYPE_LABELS[field.type]}
                  {field.type === 'computed' ? ' · muokattava lomakkeella' : ''}
                </Text>
              </AppCard>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                  disabled={index === 0}
                  onPress={() => setDraft((current) => moveFieldOnPage(current, page.id, field.id, -1))}
                >
                  <Text style={styles.moveButtonText}>↑</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.moveButton,
                    index === assigned.length - 1 && styles.moveButtonDisabled,
                  ]}
                  disabled={index === assigned.length - 1}
                  onPress={() => setDraft((current) => moveFieldOnPage(current, page.id, field.id, 1))}
                >
                  <Text style={styles.moveButtonText}>↓</Text>
                </Pressable>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => setDraft((current) => removeFieldFromPage(current, page.id, field.id))}
                >
                  <Text style={styles.removeButtonText}>Poista</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Lisää kenttä</Text>
        {available.length === 0 ? (
          <Text style={styles.empty}>Kaikki kentät on jo lisätty jollekin sivulle</Text>
        ) : (
          available.map((field) => (
            <AppCard
              key={field.id}
              style={styles.addCard}
              onPress={() => setDraft((current) => addFieldToPage(current, page.id, field.id))}
            >
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldMeta}>{FIELD_TYPE_LABELS[field.type]}</Text>
            </AppCard>
          ))
        )}

        <OutlinedButton
          title="Luo uusi kenttä"
          onPress={() => router.push('/settings/calculation/fields/new' as Href)}
        />

        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
      {exitDialog}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 20,
    marginBottom: 4,
  },
  sectionTitle: {
    marginTop: 8,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
  },
  empty: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
  },
  row: {
    gap: 6,
  },
  card: {
    marginBottom: 0,
  },
  addCard: {
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
    paddingBottom: 4,
  },
  moveButton: {
    width: 32,
    height: 32,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButtonDisabled: {
    opacity: 0.35,
  },
  moveButtonText: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 16,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
  },
});
