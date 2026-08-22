import { router, Stack, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { OutlinedButton, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { ReorderButtons } from '@/src/components/ReorderButtons';
import {
  addPage,
  createPageDraft,
  movePage,
  removePage,
} from '@/src/core/form/formEditor';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function FormPagesScreen() {
  const { ready, formDefinition, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();

  if (!ready) return <ScreenLoading />;

  const pages = [...formDefinition.pages].sort((a, b) => a.sortOrder - b.sortOrder);

  async function persist(nextForm: typeof formDefinition) {
    await db.saveFormDefinition(nextForm);
    await refreshFormSettings();
  }

  async function handleAdd() {
    const next = addPage(formDefinition, createPageDraft(createId(), formDefinition));
    await persist(next);
    const created = next.pages[next.pages.length - 1];
    if (created) {
      router.push(`/settings/calculation/pages/${created.id}` as Href);
    }
  }

  function handleDelete(pageId: string, title: string, isSystem: boolean) {
    if (isSystem) {
      showAlert('Järjestelmäsivu', 'Asiakas- ja materiaalisivuja ei voi poistaa.');
      return;
    }
    showAlert('Poista sivu', `Poistetaanko sivu "${title}" ja sen kentät?`, [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Poista',
        style: 'destructive',
        onPress: () => {
          void persist(removePage(formDefinition, pageId));
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Lomakepohja' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.helpText}>
          Lisää sivuja, nimeä ne ja järjestä. Sivun kenttiä muokataan avaamalla sivu.
        </Text>
        {pages.map((page, index) => (
          <View key={page.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.index}>{index + 1}.</Text>
              <Text
                style={styles.label}
                onPress={() => router.push(`/settings/calculation/pages/${page.id}` as Href)}
              >
                {page.title}
                {page.system ? ' · järjestelmä' : ''}
              </Text>
            </View>
            <ReorderButtons
              index={index}
              count={pages.length}
              onMove={(direction) => {
                void persist(movePage(formDefinition, page.id, direction));
              }}
            />
            <Text
              style={[styles.delete, page.system && styles.deleteDisabled]}
              onPress={() => handleDelete(page.id, page.title, Boolean(page.system))}
            >
              ×
            </Text>
          </View>
        ))}
        <View style={styles.buttons}>
          <OutlinedButton title="Lisää sivu" onPress={() => void handleAdd()} />
          <PrimaryButton
            title="Kaikki kentät"
            onPress={() => router.push('/settings/calculation/fields' as Href)}
          />
        </View>
      </ScrollView>
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
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    padding: 14,
    gap: 8,
  },
  rowText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  index: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.accent,
    width: 24,
  },
  label: {
    flex: 1,
    fontFamily: 'IBMPlexSans_500Medium',
    color: AppColors.primary,
  },
  delete: {
    color: AppColors.accent,
    fontSize: 24,
    paddingHorizontal: 4,
    fontFamily: 'IBMPlexSans_700Bold',
  },
  deleteDisabled: {
    opacity: 0.25,
  },
  buttons: {
    marginTop: 12,
    gap: 12,
  },
});
