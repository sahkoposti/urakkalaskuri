import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { PrimaryButton, ScreenMessage } from '@/src/components/common';
import {
  EDITABLE_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  generateId,
  pagesAssignableForNewField,
} from '@/src/core/form/formMutations';
import type { FieldType } from '@/src/core/form/types';
import { useStructureFormEditor } from '@/src/hooks/useStructureFormEditor';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

const NO_PAGE = '';

export default function NewFormFieldScreen() {
  const styles = useThemedStyles(createStyles);
  const { formDefinition, href } = useStructureFormEditor();
  const [type, setType] = useState<FieldType>('number');
  const [targetPageId, setTargetPageId] = useState(NO_PAGE);
  const assignablePages = useMemo(
    () => (formDefinition ? pagesAssignableForNewField(formDefinition) : []),
    [formDefinition],
  );

  if (!formDefinition) return <ScreenMessage message="Tuoterakennetta ei löytynyt." />;

  function handleCreate() {
    const fieldId = generateId('field');
    const params = new URLSearchParams({ draft: '1', type });
    if (targetPageId) params.set('pageId', targetPageId);
    router.replace(href(`/settings/calculation/fields/${fieldId}?${params.toString()}`));
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Uusi kenttä' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Valitse tyyppi ja halutessasi sivu. Kenttä tallennetaan vasta kun painat editorissa
          Tallenna. Jos poistut tallentamatta, kenttää ei luoda. Tuotelista noutaa vaihtoehdot
          tuoterekisteristä.
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

        <AppPicker
          label="Lisää sivulle (valinnainen)"
          selectedValue={targetPageId}
          onValueChange={setTargetPageId}
          allowEmpty
          placeholder="Ei sivulle"
          items={assignablePages.map((page) => ({
            value: page.id,
            label: page.title,
          }))}
        />
        <Text style={styles.hint}>Valittu sivu saa kentän viimeiseksi.</Text>

        <PrimaryButton title="Jatka muokkaukseen" onPress={handleCreate} />
      </ScrollView>
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
    help: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 20,
      marginBottom: 4,
    },
    hint: {
      marginTop: -8,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      opacity: 0.75,
      lineHeight: 18,
      fontSize: 13,
    },
  };
}
