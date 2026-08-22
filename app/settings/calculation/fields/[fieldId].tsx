import { Picker } from '@react-native-picker/picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormulaDebugPanel } from '@/src/components/form/FormulaDebugPanel';
import {
  AppInput,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import { getFieldById, updateFieldInForm } from '@/src/core/form/pipeline';
import type { FormField } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function FormFieldEditorScreen() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const { ready, formDefinition, formDebug, refreshFormSettings } = useApp();
  const [field, setField] = useState<FormField | null>(null);
  const [draftForm, setDraftForm] = useState(formDefinition);

  useEffect(() => {
    const existing = getFieldById(formDefinition, fieldId);
    setField(existing ?? null);
    setDraftForm(formDefinition);
  }, [formDefinition, fieldId]);

  const previewForm = useMemo(() => {
    if (!field) return draftForm;
    return updateFieldInForm(draftForm, field);
  }, [draftForm, field]);

  if (!ready) return <ScreenLoading />;
  if (!field) return <ScreenMessage message="Kenttää ei löytynyt." />;

  async function handleSave() {
    const nextForm = updateFieldInForm(draftForm, field!);
    await db.saveFormDefinition(nextForm);
    await refreshFormSettings();
    router.back();
  }

  function updateField(patch: Partial<FormField>) {
    setField((current) => (current ? { ...current, ...patch } : current));
  }

  const isInputField = field.type !== 'computed' && field.type !== 'section';
  const isComputed = field.type === 'computed';

  return (
    <>
      <Stack.Screen options={{ title: field.label }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppInput label="Nimi" value={field.label} onChangeText={(label) => updateField({ label })} />
        <AppInput
          label="Muuttuja (key)"
          value={field.key}
          onChangeText={(key) => updateField({ key })}
          placeholder="esim. pinta_ala"
        />

        {isComputed ? (
          <AppInput
            label="Kaava"
            value={field.formula ?? ''}
            onChangeText={(formula) => updateField({ formula })}
            multiline
            placeholder="(pinta_ala - aukot) * kerroin"
          />
        ) : null}

        {isInputField && formDebug.enabled ? (
          field.type === 'select' ? (
            <View style={styles.pickerWrap}>
              <Text style={styles.inputLabel}>Debug-esimerkki (valinta)</Text>
              <Picker
                selectedValue={field.debugExampleValue ?? ''}
                onValueChange={(value) => updateField({ debugExampleValue: value })}
              >
                <Picker.Item label="Valitse..." value="" />
                {field.options?.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>
          ) : (
            <AppInput
              label="Debug-esimerkkiarvo"
              value={field.debugExampleValue ?? ''}
              onChangeText={(debugExampleValue) => updateField({ debugExampleValue })}
              placeholder={field.type === 'number' ? 'Esim. 120' : 'Esimerkkiarvo'}
              keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
            />
          )
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Näytä yhteenvetolomakkeella</Text>
          <Switch
            value={field.showOnSummary}
            onValueChange={(showOnSummary) => updateField({ showOnSummary })}
            trackColor={{ true: AppColors.accent, false: AppColors.border }}
          />
        </View>

        {formDebug.enabled && isComputed ? (
          <FormulaDebugPanel
            form={previewForm}
            focusFieldKey={field.key}
            formula={field.formula}
          />
        ) : null}

        {!formDebug.enabled && isComputed ? (
          <Text style={styles.disabledHint}>
            Ota debug-tila käyttöön (Lomakeasetukset → Debug) nähdäksesi live-laskennan.
          </Text>
        ) : null}

        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  pickerWrap: {
    marginBottom: 12,
  },
  inputLabel: {
    marginBottom: 6,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 12,
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontFamily: 'IBMPlexSans_500Medium',
    color: AppColors.text,
  },
  disabledHint: {
    marginTop: 12,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 20,
  },
});
