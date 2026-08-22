import { Picker } from '@react-native-picker/picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormulaDebugPanel } from '@/src/components/form/FormulaDebugPanel';
import { SelectOptionsEditor } from '@/src/components/form/SelectOptionsEditor';
import {
  AppInput,
  OutlinedButton,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  createSelectOption,
  defaultExportKey,
  EDITABLE_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  getFieldById,
  pagesUsingField,
  removeField,
  updateField,
} from '@/src/core/form/formMutations';
import type { FieldType, FormField } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import { AppColors } from '@/src/theme/colors';

function fieldsEqual(a: FormField, b: FormField): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyFieldTypeChange(current: FormField, type: FieldType): FormField {
  const next: FormField = {
    ...current,
    type,
    required: type !== 'section' && type !== 'computed' ? current.required : false,
  };

  if (type === 'select') {
    return {
      ...next,
      options: current.options?.length
        ? current.options
        : [{ ...createSelectOption('Vaihtoehto 1'), exportKey: defaultExportKey(current.key) }],
    };
  }

  if (type === 'computed') {
    return { ...next, formula: current.formula ?? '', showOnSummary: true, allowManualOverride: true };
  }

  if (type === 'number' && !next.unit) {
    return { ...next, unit: '' };
  }

  const { options: _options, formula: _formula, ...rest } = next;
  return rest as FormField;
}

export default function FormFieldEditorScreen() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const { ready, formDefinition, formDebug, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [field, setField] = useState<FormField | null>(null);
  const [savedField, setSavedField] = useState<FormField | null>(null);
  const [draftForm, setDraftForm] = useState(formDefinition);
  const [deleteVisible, setDeleteVisible] = useState(false);

  useEffect(() => {
    const existing = getFieldById(formDefinition, fieldId);
    setField(existing ?? null);
    setSavedField(existing ?? null);
    setDraftForm(formDefinition);
  }, [formDefinition, fieldId]);

  const previewForm = useMemo(() => {
    if (!field) return draftForm;
    return updateField(draftForm, field);
  }, [draftForm, field]);

  const isDirty = useMemo(() => {
    if (!field || !savedField) return false;
    return !fieldsEqual(field, savedField);
  }, [field, savedField]);

  async function persistSettings(): Promise<boolean> {
    if (!field) return false;

    if (!field.label.trim()) {
      showAlert('Virhe', 'Kentällä on oltava nimi.');
      return false;
    }
    if (!/^[a-z0-9_]+$/i.test(field.key)) {
      showAlert('Virhe', 'Muuttujan nimi saa sisältää vain kirjaimia, numeroita ja alaviivoja.');
      return false;
    }
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      showAlert('Virhe', 'Valintakentällä on oltava vähintään yksi valinta.');
      return false;
    }
    if (field.type === 'select') {
      const missingExport = field.options?.some(
        (option) => !option.exportKey?.trim() || option.multiplier === undefined,
      );
      if (missingExport) {
        showAlert('Virhe', 'Jokaisella valinnalla on oltava kerroin ja export-muuttuja.');
        return false;
      }
    }
    if (field.type === 'computed' && !field.formula?.trim()) {
      showAlert('Virhe', 'Lasketulla kentällä on oltava kaava.');
      return false;
    }

    const duplicateKey = formDefinition.fields.some(
      (item) => item.id !== field.id && item.key === field.key,
    );
    if (duplicateKey) {
      showAlert('Virhe', 'Muuttujan nimi on jo käytössä toisella kentällä.');
      return false;
    }

    const nextForm = updateField(draftForm, field);
    await db.saveFormDefinition(nextForm);
    await refreshFormSettings();
    setSavedField(field);
    setDraftForm(nextForm);
    return true;
  }

  const { allowExit, exitDialog } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!ready) return <ScreenLoading />;
  if (!field) return <ScreenMessage message="Kenttää ei löytynyt." />;

  const editingField = field;

  async function handleSave() {
    const saved = await persistSettings();
    if (!saved) return;
    allowExit();
    router.back();
  }

  async function handleDelete() {
    const next = removeField(formDefinition, editingField.id);
    await db.saveFormDefinition(next);
    await refreshFormSettings();
    allowExit();
    setDeleteVisible(false);
    router.back();
  }

  function updateFieldState(patch: Partial<FormField>) {
    setField((current) => (current ? { ...current, ...patch } : current));
  }

  function handleTypeChange(type: FieldType) {
    setField((current) => (current ? applyFieldTypeChange(current, type) : current));
  }

  const isInputField = editingField.type !== 'computed' && editingField.type !== 'section';
  const isComputed = editingField.type === 'computed';
  const isNumberLike = editingField.type === 'number' || editingField.type === 'computed';
  const usedOnPages = pagesUsingField(formDefinition, editingField.id);
  const exportKeyDefault =
    editingField.type === 'select'
      ? editingField.options?.[0]?.exportKey ?? defaultExportKey(editingField.key)
      : defaultExportKey(editingField.key);

  return (
    <>
      <Stack.Screen options={{ title: editingField.label }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>
          Kenttä on globaali. Lisää se sivuille kohdasta Lomakeasetukset → Sivut → Valitse kentät.
          {usedOnPages.length > 0
            ? ` Näkyy sivuilla: ${usedOnPages.map((page) => page.title).join(', ')}.`
            : ' Ei vielä millään sivulla.'}
        </Text>

        <View style={styles.pickerWrap}>
          <Text style={styles.pickerLabel}>Kenttätyyppi</Text>
          <Picker
            selectedValue={field.type}
            onValueChange={(value) => handleTypeChange(value as FieldType)}
          >
            {EDITABLE_FIELD_TYPES.includes(field.type) ? null : (
              <Picker.Item label={FIELD_TYPE_LABELS[field.type]} value={field.type} />
            )}
            {EDITABLE_FIELD_TYPES.map((fieldType) => (
              <Picker.Item
                key={fieldType}
                label={FIELD_TYPE_LABELS[fieldType]}
                value={fieldType}
              />
            ))}
          </Picker>
        </View>

        <AppInput label="Nimi" value={field.label} onChangeText={(label) => updateFieldState({ label })} />
        <AppInput
          label="Muuttuja (key)"
          value={field.key}
          onChangeText={(key) => updateFieldState({ key: key.trim().toLowerCase() })}
          placeholder="esim. pinta_ala"
        />

        {isNumberLike ? (
          <AppInput
            label="Yksikkö"
            value={field.unit ?? ''}
            onChangeText={(unit) => updateFieldState({ unit })}
            placeholder="esim. m²"
          />
        ) : null}

        {field.type === 'select' ? (
          <SelectOptionsEditor
            options={field.options ?? []}
            defaultExportKey={exportKeyDefault}
            onChange={(options) => updateFieldState({ options })}
          />
        ) : null}

        {isComputed ? (
          <AppInput
            label="Kaava"
            value={field.formula ?? ''}
            onChangeText={(formula) => updateFieldState({ formula })}
            multiline
            placeholder="(pinta_ala - aukot) * laudoituskerroin"
          />
        ) : null}

        {isComputed ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Muokattavissa lomakkeella (esitäytetty laskennalla)</Text>
            <Switch
              value={field.allowManualOverride !== false}
              onValueChange={(allowManualOverride) => updateFieldState({ allowManualOverride })}
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        ) : null}

        {isInputField ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Pakollinen</Text>
            <Switch
              value={field.required}
              onValueChange={(required) => updateFieldState({ required })}
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        ) : null}

        {isInputField && formDebug.enabled ? (
          field.type === 'select' ? (
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Debug-esimerkki (valinta)</Text>
              <Picker
                selectedValue={field.debugExampleValue ?? ''}
                onValueChange={(value) => updateFieldState({ debugExampleValue: value })}
              >
                <Picker.Item label="Valitse..." value="" />
                {field.options?.map((option) => (
                  <Picker.Item key={option.value} label={option.label} value={option.value} />
                ))}
              </Picker>
            </View>
          ) : field.type === 'boolean' ? (
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Debug-esimerkki</Text>
              <Picker
                selectedValue={field.debugExampleValue ?? 'false'}
                onValueChange={(value) => updateFieldState({ debugExampleValue: value })}
              >
                <Picker.Item label="Ei" value="false" />
                <Picker.Item label="Kyllä" value="true" />
              </Picker>
            </View>
          ) : (
            <AppInput
              label="Debug-esimerkkiarvo"
              value={field.debugExampleValue ?? ''}
              onChangeText={(debugExampleValue) => updateFieldState({ debugExampleValue })}
              placeholder={field.type === 'number' ? 'Esim. 120' : 'Esimerkkiarvo'}
              keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
            />
          )
        ) : null}

        {field.type !== 'section' ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Näytä yhteenvetolomakkeella</Text>
            <Switch
              value={field.showOnSummary}
              onValueChange={(showOnSummary) => updateFieldState({ showOnSummary })}
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        ) : null}

        <AppInput
          label="Ohjeteksti (valinnainen)"
          value={field.helpText ?? ''}
          onChangeText={(helpText) => updateFieldState({ helpText })}
          multiline
          placeholder="Näytetään kentän alla laskennassa"
        />

        {formDebug.enabled && isComputed ? (
          <FormulaDebugPanel
            form={previewForm}
            focusFieldKey={field.key}
            formula={field.formula}
            showIntermediateSteps={formDebug.showIntermediateSteps}
          />
        ) : null}

        {!formDebug.enabled && isComputed ? (
          <Text style={styles.disabledHint}>
            Ota debug-tila käyttöön (Lomakeasetukset → Debug) nähdäksesi live-laskennan.
          </Text>
        ) : null}

        <PrimaryButton title="Tallenna" onPress={handleSave} />
        <OutlinedButton title="Poista kenttä" onPress={() => setDeleteVisible(true)} />
      </ScrollView>

      <ConfirmDialog
        visible={deleteVisible}
        title="Poista kenttä?"
        message={`Poistetaanko kenttä "${field.label}"?`}
        onClose={() => setDeleteVisible(false)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDeleteVisible(false) },
          {
            title: 'Poista',
            variant: 'destructive',
            onPress: () => {
              void handleDelete();
            },
          },
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
    gap: 4,
  },
  help: {
    marginBottom: 8,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 20,
  },
  pickerWrap: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    marginBottom: 12,
  },
  pickerLabel: {
    paddingHorizontal: 14,
    paddingTop: 12,
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
