import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { PrimaryButton, ScreenLoading } from '@/src/components/common';
import {
  addField,
  EDITABLE_FIELD_TYPES,
  FIELD_TYPE_LABELS,
} from '@/src/core/form/formMutations';
import type { FieldType } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function NewFormFieldScreen() {
  const { ready, formDefinition, refreshFormSettings } = useApp();
  const [type, setType] = useState<FieldType>('number');
  const [saving, setSaving] = useState(false);

  if (!ready) return <ScreenLoading />;

  async function handleCreate() {
    if (saving) return;
    setSaving(true);
    try {
      const next = addField(formDefinition, type);
      const created = next.fields[next.fields.length - 1];
      await db.saveFormDefinition(next);
      await refreshFormSettings();
      router.replace(`/settings/calculation/fields/${created.id}` as Href);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Uusi kenttä' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Luo globaali kenttä. Tuotelista noutaa vaihtoehdot tuoterekisteristä. Lisää kenttä
          sivulle kohdasta Lomakeasetukset → Sivut.
        </Text>

        <AppPicker
          label="Kenttätyyppi"
          selectedValue={type}
          onValueChange={(value) => setType(value as FieldType)}
          items={EDITABLE_FIELD_TYPES.map((fieldType) => ({
            value: fieldType,
            label: FIELD_TYPE_LABELS[fieldType],
          }))}
        />

        <PrimaryButton title={saving ? 'Luodaan…' : 'Luo kenttä'} onPress={handleCreate} disabled={saving} />
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
    lineHeight: 20,
    marginBottom: 4,
  },
});
