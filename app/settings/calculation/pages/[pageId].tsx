import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppInput,
  OutlinedButton,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import { ReorderButtons } from '@/src/components/ReorderButtons';
import {
  addField,
  createFieldDraft,
  fieldsForPage,
  getPageById,
  moveField,
  removeField,
  updatePage,
} from '@/src/core/form/formEditor';
import { FIELD_TYPE_LABELS } from '@/src/core/form/types';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function FormPageEditorScreen() {
  const { pageId } = useLocalSearchParams<{ pageId: string }>();
  const { ready, formDefinition, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();

  const page = getPageById(formDefinition, pageId);
  const [title, setTitle] = useState(page?.title ?? '');

  useEffect(() => {
    if (page) setTitle(page.title);
  }, [page?.id, page?.title]);

  if (!ready) return <ScreenLoading />;
  if (!page) return <ScreenMessage message="Sivua ei löytynyt." />;

  const fields = fieldsForPage(formDefinition, page.id);

  async function persist(nextForm: typeof formDefinition) {
    const withTitle = title.trim() && title !== page!.title
      ? updatePage(nextForm, page!.id, { title: title.trim() })
      : nextForm;
    await db.saveFormDefinition(withTitle);
    await refreshFormSettings();
  }

  async function handleAddField() {
    const draft = createFieldDraft(createId(), formDefinition, page!.id);
    const next = addField(formDefinition, draft);
    await persist(next);
    router.push(`/settings/calculation/fields/${draft.id}` as Href);
  }

  function handleDeleteField(fieldId: string, label: string) {
    showAlert('Poista kenttä', `Poistetaanko kenttä "${label}"?`, [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Poista',
        style: 'destructive',
        onPress: () => {
          void persist(removeField(formDefinition, fieldId));
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: page.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppInput label="Sivun nimi" value={title} onChangeText={setTitle} />
        {page.system ? (
          <Text style={styles.help}>Järjestelmäsivu – sivua ei voi poistaa.</Text>
        ) : null}

        <Text style={styles.section}>Kentät</Text>
        {fields.length === 0 ? <Text style={styles.help}>Ei kenttiä tällä sivulla.</Text> : null}
        {fields.map((field, index) => (
          <View key={field.id} style={styles.row}>
            <Text
              style={styles.label}
              onPress={() => router.push(`/settings/calculation/fields/${field.id}` as Href)}
            >
              {field.label}
              {'\n'}
              <Text style={styles.meta}>
                {field.key} · {FIELD_TYPE_LABELS[field.type]}
              </Text>
            </Text>
            <ReorderButtons
              index={index}
              count={fields.length}
              onMove={(direction) => {
                void persist(moveField(formDefinition, field.id, direction));
              }}
            />
            <Text style={styles.delete} onPress={() => handleDeleteField(field.id, field.label)}>
              ×
            </Text>
          </View>
        ))}

        <View style={styles.buttons}>
          <OutlinedButton title="Lisää kenttä" onPress={() => void handleAddField()} />
          <PrimaryButton
            title="Valmis"
            onPress={() => {
              void persist(formDefinition).then(() => router.back());
            }}
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
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
  },
  section: {
    marginTop: 8,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
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
  label: {
    flex: 1,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
    fontSize: 15,
  },
  meta: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
  },
  delete: {
    color: AppColors.accent,
    fontSize: 24,
    paddingHorizontal: 4,
    fontFamily: 'IBMPlexSans_700Bold',
  },
  buttons: {
    marginTop: 8,
    gap: 12,
  },
});
