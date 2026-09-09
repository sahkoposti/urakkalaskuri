import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppInput, OutlinedButton, PrimaryButton, ScreenMessage } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { ReorderControls } from '@/src/components/ReorderControls';
import {
  addPage,
  fieldsForPage,
  formsEqual,
  movePage,
  removePage,
  sortedPages,
  updatePage,
} from '@/src/core/form/formMutations';
import type { FormDefinition, FormPage } from '@/src/core/form/types';
import { useStructureFormEditor } from '@/src/hooks/useStructureFormEditor';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function FormPagesSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { persistForm, formDefinition, href } = useStructureFormEditor();
  const { showAlert } = useThemedAlert();
  const [draft, setDraft] = useState<FormDefinition | null>(formDefinition ?? null);
  const [deleteTarget, setDeleteTarget] = useState<FormPage | null>(null);

  useEffect(() => {
    if (formDefinition) setDraft(formDefinition);
  }, [formDefinition]);

  const isDirty = useMemo(
    () => Boolean(formDefinition && draft && !formsEqual(draft, formDefinition)),
    [draft, formDefinition],
  );

  async function persistSettings(): Promise<boolean> {
    if (!draft) return false;
    const emptyTitle = sortedPages(draft).find((page) => !page.title.trim());
    if (emptyTitle) {
      showAlert('Virhe', 'Kaikilla sivuilla on oltava nimi.');
      return false;
    }
    await persistForm(draft);
    return true;
  }

  const { exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!formDefinition || !draft) return <ScreenMessage message="Tuoterakennetta ei löytynyt." />;

  const pages = sortedPages(draft);

  async function handleSave() {
    await save();
  }

  function patchDraft(updater: (form: FormDefinition) => FormDefinition) {
    setDraft((current) => (current ? updater(current) : current));
  }

  function handleAddPage() {
    patchDraft((current) => addPage(current, 'Uusi sivu'));
  }

  function handleRenamePage(pageId: string, title: string) {
    patchDraft((current) => updatePage(current, pageId, { title }));
  }

  function confirmDeletePage() {
    if (!deleteTarget) return;
    patchDraft((current) => removePage(current, deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Sivut' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.helpText}>
          Luo ja järjestä laskennan sivut. Valitse kunkin sivun kentät erikseen. Asiakkaan nimi ja
          yhteystiedot ovat laskennan omalla Asiakas-kortilla, eivät lomakkeen sivuilla. Materiaalit
          tulevat kaavoista ja kenttävaikutuksista (esim. add_material_fixed). Erillinen
          materiaalirivisivu ei ole pakollinen.
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
                    router.push(href(`/settings/calculation/pages/${page.id}`))
                  }
                />
              </View>
            </View>
            <View style={styles.actions}>
              <ReorderControls
                index={index}
                count={pages.length}
                onMove={(direction) => patchDraft((current) => movePage(current, page.id, direction))}
                onDelete={() => setDeleteTarget(page)}
              />
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

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 12,
    },
    helpText: {
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      marginBottom: 4,
      lineHeight: 20,
    },
    row: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      padding: 12,
      gap: 8,
    },
    rowMain: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    index: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.accent,
      width: 24,
      marginTop: 28,
    },
    rowFields: {
      flex: 1,
      gap: 8,
    },
    fieldCount: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
      marginTop: -4,
      marginBottom: 4,
    },
    actions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingLeft: 32,
    },
    buttons: {
      marginTop: 8,
    },
  };
}
