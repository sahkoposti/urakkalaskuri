import { router, Stack, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppInput, OutlinedButton, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  addPage,
  fieldsForPage,
  formsEqual,
  isSystemPage,
  movePage,
  removePage,
  sortedPages,
  updatePage,
} from '@/src/core/form/formMutations';
import type { FormDefinition, FormPage } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import { AppColors } from '@/src/theme/colors';

export default function FormPagesSettingsScreen() {
  const { ready, formDefinition, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [draft, setDraft] = useState<FormDefinition>(formDefinition);
  const [deleteTarget, setDeleteTarget] = useState<FormPage | null>(null);

  useEffect(() => {
    setDraft(formDefinition);
  }, [formDefinition]);

  const isDirty = useMemo(() => !formsEqual(draft, formDefinition), [draft, formDefinition]);

  async function persistSettings(): Promise<boolean> {
    const emptyTitle = sortedPages(draft).find((page) => !page.title.trim());
    if (emptyTitle) {
      showAlert('Virhe', 'Kaikilla sivuilla on oltava nimi.');
      return false;
    }
    await db.saveFormDefinition(draft);
    await refreshFormSettings();
    return true;
  }

  const { exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!ready) return <ScreenLoading />;

  const pages = sortedPages(draft);

  async function handleSave() {
    await save();
  }

  function handleAddPage() {
    setDraft((current) => addPage(current, 'Uusi sivu'));
  }

  function handleRenamePage(pageId: string, title: string) {
    setDraft((current) => updatePage(current, pageId, { title }));
  }

  function confirmDeletePage() {
    if (!deleteTarget) return;
    setDraft((current) => removePage(current, deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sivut' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.helpText}>
          Luo ja järjestä laskennan sivut. Valitse kunkin sivun kentät erikseen. Asiakas-sivua ei
          voi poistaa. Materiaalit lasketaan Tuotelista-kentistä, ei erillisestä sivusta.
        </Text>

        {pages.map((page, index) => (
          <View key={page.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.index}>{index + 1}.</Text>
              <View style={styles.rowFields}>
                <AppInput
                  label="Sivun nimi"
                  value={page.title}
                  onChangeText={(title) => handleRenamePage(page.id, title)}
                />
                <Text style={styles.fieldCount}>
                  {fieldsForPage(draft, page.id).length} kenttää tällä sivulla
                </Text>
                <OutlinedButton
                  title="Valitse kentät"
                  onPress={() =>
                    router.push(`/settings/calculation/pages/${page.id}` as Href)
                  }
                />
              </View>
            </View>
            <View style={styles.actions}>
              <Pressable
                style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                disabled={index === 0}
                onPress={() => setDraft((current) => movePage(current, page.id, -1))}
              >
                <Text style={styles.moveButtonText}>↑</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.moveButton,
                  index === pages.length - 1 && styles.moveButtonDisabled,
                ]}
                disabled={index === pages.length - 1}
                onPress={() => setDraft((current) => movePage(current, page.id, 1))}
              >
                <Text style={styles.moveButtonText}>↓</Text>
              </Pressable>
              {!isSystemPage(page) ? (
                <Pressable style={styles.deleteButton} onPress={() => setDeleteTarget(page)}>
                  <Text style={styles.deleteButtonText}>Poista</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}

        <OutlinedButton title="Lisää sivu" onPress={handleAddPage} />

        <View style={styles.buttons}>
          <PrimaryButton title="Tallenna" onPress={handleSave} />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Poista sivu?"
        message={
          deleteTarget
            ? `Poistetaanko sivu "${deleteTarget.title}"? Kentät säilyvät globaalina listana.`
            : ''
        }
        onClose={() => setDeleteTarget(null)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDeleteTarget(null) },
          { title: 'Poista', variant: 'destructive', onPress: confirmDeletePage },
        ]}
      />
      {exitDialog}
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  helpText: {
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
    marginBottom: 4,
    lineHeight: 20,
  },
  row: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    padding: 12,
    gap: 8,
  },
  rowMain: {
    flexDirection: 'row',
    gap: 8,
  },
  index: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.accent,
    width: 24,
    marginTop: 28,
  },
  rowFields: {
    flex: 1,
    gap: 8,
  },
  fieldCount: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
    marginTop: -4,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 32,
  },
  moveButton: {
    width: 36,
    height: 36,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.secondary,
  },
  moveButtonDisabled: {
    opacity: 0.35,
  },
  moveButtonText: {
    color: AppColors.accent,
    fontSize: 18,
    fontFamily: 'IBMPlexSans_700Bold',
    lineHeight: 20,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deleteButtonText: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 14,
  },
  buttons: {
    marginTop: 8,
  },
});
