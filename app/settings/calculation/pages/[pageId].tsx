import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppCard, OutlinedButton, PrimaryButton, ScreenMessage } from '@/src/components/common';
import { ReorderControls } from '@/src/components/ReorderControls';
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
import { useStructureFormEditor } from '@/src/hooks/useStructureFormEditor';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function PageFieldsSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { pageId } = useLocalSearchParams<{ pageId: string }>();
  const { persistForm, formDefinition, href } = useStructureFormEditor();
  const [draft, setDraft] = useState<FormDefinition | null>(formDefinition ?? null);

  useEffect(() => {
    if (formDefinition) setDraft(formDefinition);
  }, [formDefinition]);

  const page = draft ? sortedPages(draft).find((item) => item.id === pageId) : undefined;
  const isDirty = useMemo(
    () => Boolean(formDefinition && draft && !formsEqual(draft, formDefinition)),
    [draft, formDefinition],
  );

  async function persistSettings(): Promise<boolean> {
    if (!draft) return false;
    await persistForm(draft);
    return true;
  }

  const { exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!formDefinition || !draft) return <ScreenMessage message="Tuoterakennetta ei löytynyt." />;
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
              <ReorderControls
                index={index}
                count={assigned.length}
                onMove={(direction) =>
                  setDraft((current) =>
                    current ? moveFieldOnPage(current, page.id, field.id, direction) : current,
                  )
                }
                onDelete={() =>
                  setDraft((current) =>
                    current ? removeFieldFromPage(current, page.id, field.id) : current,
                  )
                }
              />
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
              onPress={() =>
                setDraft((current) => (current ? addFieldToPage(current, page.id, field.id) : current))
              }
            >
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <Text style={styles.fieldMeta}>{FIELD_TYPE_LABELS[field.type]}</Text>
            </AppCard>
          ))
        )}

        <OutlinedButton
          title="Luo uusi kenttä"
          onPress={() => router.push(href('/settings/calculation/fields/new'))}
        />

        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
      {exitDialog}
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 10,
    },
    help: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 20,
      marginBottom: 4,
    },
    sectionTitle: {
      marginTop: 8,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
      fontSize: 16,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
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
      color: colors.primary,
      fontSize: 15,
    },
    fieldMeta: {
      marginTop: 4,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
    },
  };
}
