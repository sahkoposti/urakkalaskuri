import { Picker } from '@react-native-picker/picker';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, ScreenLoading } from '@/src/components/common';
import {
  addField,
  EDITABLE_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  pagesAssignableForNewField,
} from '@/src/core/form/formMutations';
import type { FieldType } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

const NO_PAGE = '';

export default function NewFormFieldScreen() {
  const { ready, formDefinition, refreshFormSettings } = useApp();
  const [type, setType] = useState<FieldType>('number');
  const [targetPageId, setTargetPageId] = useState(NO_PAGE);
  const [saving, setSaving] = useState(false);
  const assignablePages = useMemo(
    () => pagesAssignableForNewField(formDefinition),
    [formDefinition],
  );

  if (!ready) return <ScreenLoading />;

  async function handleCreate() {
    if (saving) return;
    setSaving(true);
    try {
      const next = addField(formDefinition, type, targetPageId || undefined);
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
          Luo globaali kenttä. Tuotelista noutaa vaihtoehdot tuoterekisteristä. Sivulle lisääminen
          ei ole pakollista: ilman valintaa kenttä jää ilman sivua, ja voit liittää sen myöhemmin
          kohdasta Lomakeasetukset → Sivut.
        </Text>

        <View style={styles.pickerWrap}>
          <Text style={styles.label}>Kenttätyyppi</Text>
          <Picker selectedValue={type} onValueChange={(value) => setType(value as FieldType)}>
            {EDITABLE_FIELD_TYPES.map((fieldType) => (
              <Picker.Item
                key={fieldType}
                label={FIELD_TYPE_LABELS[fieldType]}
                value={fieldType}
              />
            ))}
          </Picker>
        </View>

        <View style={styles.pickerWrap}>
          <Text style={styles.label}>Lisää sivulle (valinnainen)</Text>
          <Picker selectedValue={targetPageId} onValueChange={setTargetPageId}>
            <Picker.Item label="Ei sivulle" value={NO_PAGE} />
            {assignablePages.map((page) => (
              <Picker.Item key={page.id} label={page.title} value={page.id} />
            ))}
          </Picker>
        </View>
        <Text style={styles.hint}>
          Valittu sivu saa kentän viimeiseksi. Asiakas-sivulle ei voi sijoittaa.
        </Text>

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
  pickerWrap: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    marginBottom: 8,
  },
  label: {
    paddingHorizontal: 14,
    paddingTop: 12,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
  },
  hint: {
    marginTop: -8,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    opacity: 0.75,
    lineHeight: 18,
    fontSize: 13,
  },
});
