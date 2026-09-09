import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';

import { FieldDefaultValueEditor } from '@/src/components/form/FieldDefaultValueEditor';
import { FieldEffectsEditor } from '@/src/components/form/FieldEffectsEditor';
import { FieldVisibilityEditor } from '@/src/components/form/FieldVisibilityEditor';
import { FormulaDebugPanel } from '@/src/components/form/FormulaDebugPanel';
import { ProductFormulaHints } from '@/src/components/form/ProductFormulaHints';
import { SelectOptionsEditor } from '@/src/components/form/SelectOptionsEditor';
import {
  AppInput,
  AppSwitch,
  OutlinedButton,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  buildDuplicatedField,
  createField,
  createSelectOption,
  EDITABLE_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  generateId,
  getFieldById,
  insertField,
  pagesUsingField,
  removeField,
  unknownFormulaIdentifiers,
  updateField,
} from '@/src/core/form/formMutations';
import { sanitizeKeyInput } from '@/src/core/form/formKeyUtils';
import { MATERIALS_CONTEXT_KEY } from '@/src/core/form/systemFields';
import { isProductField } from '@/src/core/form/productFieldUtils';
import { isFieldEffectComplete } from '@/src/core/form/fieldEffects';
import { parseNumber } from '@/src/core/utils/formatters';
import { isSystemField, isSystemFieldHiddenFromUi, restoreSystemField } from '@/src/core/form/systemFields';
import type { FieldType, FormField } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

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
      options: current.options?.length ? current.options : [createSelectOption('Vaihtoehto 1')],
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
  const styles = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{
    fieldId: string;
    draft?: string;
    type?: string;
    pageId?: string;
    duplicateFrom?: string;
  }>();
  const fieldId = firstParam(params.fieldId);
  const isDraftParam = firstParam(params.draft) === '1';
  const createType = firstParam(params.type) as FieldType | '';
  const assignPageId = firstParam(params.pageId);
  const duplicateFrom = firstParam(params.duplicateFrom);
  const { ready, formDefinition, formDebug, settings, products, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [field, setField] = useState<FormField | null>(null);
  const [savedField, setSavedField] = useState<FormField | null>(null);
  const [draftForm, setDraftForm] = useState(formDefinition);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const draftInitRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (isDraftParam) {
      if (draftInitRef.current === fieldId) return;
      draftInitRef.current = fieldId;

      let created: FormField | null = null;
      if (duplicateFrom) {
        const copy = buildDuplicatedField(formDefinition, duplicateFrom);
        created = copy ? { ...copy, id: fieldId } : null;
      } else if (EDITABLE_FIELD_TYPES.includes(createType as FieldType)) {
        created = { ...createField(createType as FieldType, formDefinition), id: fieldId };
      }

      if (!created) {
        setField(null);
        setSavedField(null);
        setDraftForm(formDefinition);
        return;
      }

      setField(created);
      setSavedField(null);
      setDraftForm(insertField(formDefinition, created, assignPageId || undefined));
      return;
    }

    draftInitRef.current = null;
    const existing = getFieldById(formDefinition, fieldId);
    setField(existing ?? null);
    setSavedField(existing ?? null);
    setDraftForm(formDefinition);
  }, [ready, formDefinition, fieldId, isDraftParam, createType, assignPageId, duplicateFrom]);

  const previewForm = useMemo(() => {
    if (!field) return draftForm;
    return getFieldById(draftForm, field.id) ? updateField(draftForm, field) : insertField(draftForm, field);
  }, [draftForm, field]);

  const isUnsavedDraft = field !== null && savedField === null;
  const isDirty = useMemo(() => {
    if (!field) return false;
    if (!savedField) return true;
    return !fieldsEqual(field, savedField);
  }, [field, savedField]);

  async function persistSettings(): Promise<boolean> {
    if (!field) return false;
    if (isSystemFieldHiddenFromUi(field)) {
      showAlert('Virhe', 'Tätä järjestelmäkenttää ei voi muokata.');
      return false;
    }

    if (!field.label.trim()) {
      showAlert('Virhe', 'Näyttönimi on pakollinen.');
      return false;
    }
    if (!field.systemKey && !/^[a-z0-9_]+$/.test(field.key)) {
      showAlert('Virhe', 'Muuttujan nimi saa sisältää vain pienet kirjaimet, numeroita ja alaviivoja (ei ä/ö/spaces).');
      return false;
    }
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      showAlert('Virhe', 'Valintakentällä on oltava vähintään yksi valinta.');
      return false;
    }
    if (field.type === 'select') {
      const invalidOption = field.options?.some((option) => {
        if (!option.label.trim()) return true;
        return parseNumber(option.value) === null;
      });
      if (invalidOption) {
        showAlert('Virhe', 'Jokaisella valinnalla on oltava nimi ja numeerinen arvo.');
        return false;
      }
    }
    if (field.type === 'computed' && !field.formula?.trim() && field.allowManualOverride === false) {
      showAlert('Virhe', 'Lasketulla kentällä on oltava kaava.');
      return false;
    }
    if (field.type === 'computed' && field.formula?.trim()) {
      const unknown = unknownFormulaIdentifiers(previewForm, field.formula);
      if (unknown.length > 0) {
        showAlert('Virhe', `Tuntemattomat muuttujat kaavassa: ${unknown.join(', ')}`);
        return false;
      }
    }
    const incompleteEffect = field.effects?.find((effect) => !isFieldEffectComplete(effect, field));
    if (incompleteEffect) {
      showAlert('Virhe', 'Vaikutuksella on oltava numeerinen arvo.');
      return false;
    }

    const duplicateKey = formDefinition.fields.some(
      (item) => item.id !== field.id && item.key === field.key,
    );
    if (duplicateKey) {
      showAlert('Virhe', 'Muuttujan nimi on jo käytössä toisella kentällä.');
      return false;
    }

    const nextForm = getFieldById(draftForm, field.id)
      ? updateField(draftForm, field)
      : insertField(draftForm, field, assignPageId || undefined);
    await db.saveFormDefinition(nextForm);
    await refreshFormSettings();
    setSavedField(field);
    setDraftForm(nextForm);
    return true;
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!ready) return <ScreenLoading />;
  if (!field) return <ScreenMessage message="Kenttää ei löytynyt." />;
  if (isSystemFieldHiddenFromUi(field)) {
    return <ScreenMessage message="Tätä järjestelmäkenttää ei voi muokata. Se on käytössä vain laskennassa." />;
  }

  const editingField = field;
  const isSystem = isSystemField(editingField);

  async function handleRestoreSystemDefaults() {
    const restored = restoreSystemField(editingField);
    setField(restored);
  }

  async function handleSave() {
    const saved = await save();
    if (!saved) return;
    allowExit();
    router.back();
  }

  async function handleDuplicate() {
    if (isUnsavedDraft) return;
    const copyId = generateId('field');
    allowExit();
    router.replace(
      `/settings/calculation/fields/${copyId}?draft=1&duplicateFrom=${editingField.id}` as Href,
    );
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
  const usedOnPages = pagesUsingField(previewForm, editingField.id);

  return (
    <>
      <Stack.Screen options={{ title: editingField.label }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.help}>
          {isUnsavedDraft
            ? 'Kenttää ei ole vielä tallennettu. Poistuminen ilman tallennusta peruu luonnin.'
            : 'Kenttä on globaali. Lisää se sivuille kohdasta Lomakeasetukset → Sivut → Valitse kentät.'}
          {usedOnPages.length > 0
            ? ` Näkyy sivuilla: ${usedOnPages.map((page) => page.title).join(', ')}.`
            : isUnsavedDraft
              ? ''
              : ' Ei vielä millään sivulla.'}
        </Text>

        {isSystem ? (
          <Text style={styles.systemBadge}>
            Järjestelmäkenttä – kaava ajaa wizardin hintaa. Voit muokata kaavaa itse; „Palauta
            oletusarvot” palauttaa alkuperäisen kaavan ja nimen. Live-laskenta käyttää
            Yleinen-asetuksia ja muiden kenttien debug-esimerkkejä.
          </Text>
        ) : null}

        {!isSystem ? (
          <AppPicker
            label="Kenttätyyppi"
            selectedValue={field.type}
            onValueChange={(value) => handleTypeChange(value as FieldType)}
            items={EDITABLE_FIELD_TYPES.map((fieldType) => ({
              value: fieldType,
              label: FIELD_TYPE_LABELS[fieldType],
            }))}
          />
        ) : (
          <Text style={styles.metaLine}>Tyyppi: {FIELD_TYPE_LABELS[field.type]} (järjestelmä)</Text>
        )}

        <AppInput
          label="Näyttönimi"
          value={field.label}
          onChangeText={(label) => updateFieldState({ label })}
          placeholder="Esimerkki: Kiinteä seinäpinta-ala"
          compact
        />
        {!isSystem ? (
          <AppInput
            label="Muuttuja (key)"
            value={field.key}
            onChangeText={(key) => updateFieldState({ key: sanitizeKeyInput(key) })}
            placeholder="esim. pinta_ala"
            compact
          />
        ) : (
          <Text style={styles.metaLine}>Muuttuja: {field.key}</Text>
        )}

        {isNumberLike ? (
          <AppInput
            label="Yksikkö"
            value={field.unit ?? ''}
            onChangeText={(unit) => updateFieldState({ unit })}
            placeholder="esim. m²"
            compact
          />
        ) : null}

        {field.type === 'select' ? (
          <SelectOptionsEditor
            fieldKey={field.key}
            options={field.options ?? []}
            onChange={(options) => updateFieldState({ options })}
          />
        ) : null}

        {isProductField(field) ? <ProductFormulaHints form={previewForm} field={field} /> : null}

        {isComputed ? (
          <>
            <AppInput
              label={isSystem ? 'Järjestelmäkaava' : 'Kaava'}
              value={field.formula ?? ''}
              onChangeText={(formula) => updateFieldState({ formula })}
              multiline
              placeholder="laskenta_seinapinta_ala_m2 / kaytettava_maali.menekki"
              compact
            />
            <Text style={styles.formulaHint}>
              Automaattinen muuttuja: {MATERIALS_CONTEXT_KEY} (materiaalit alv0, oletus 0). Funktiot:
              min(), max(), round(), if(), sqrt(). Vertailut: {'>'} {'<'} {'>='} {'<='} == !=.
              Puuttuva muuttuja on 0.
            </Text>
          </>
        ) : null}

        {!isSystem && field.type !== 'section' ? (
          <FieldEffectsEditor
            form={previewForm}
            field={field}
            onChange={(effects) => updateFieldState({ effects: effects.length ? effects : undefined })}
          />
        ) : null}

        {!isSystem && field.type !== 'section' ? (
          <FieldVisibilityEditor
            form={previewForm}
            field={field}
            condition={field.showWhen}
            onChange={(showWhen) => {
              setField((current) => {
                if (!current) return current;
                if (!showWhen) {
                  const { showWhen: _removed, ...rest } = current;
                  return rest;
                }
                return { ...current, showWhen };
              });
            }}
          />
        ) : null}

        {isSystem ? (
          <OutlinedButton title="Palauta oletusarvot" onPress={handleRestoreSystemDefaults} />
        ) : null}

        {isComputed ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              Muokattavissa lomakkeella. Manuaalinen arvo säilyy, kunnes kaavan syötteitä muutetaan
              tai kenttä tyhjennetään.
            </Text>
            <AppSwitch
              value={field.allowManualOverride !== false}
              onValueChange={(allowManualOverride) => updateFieldState({ allowManualOverride })}
            />
          </View>
        ) : null}

        {isInputField ? (
          <FieldDefaultValueEditor
            field={field}
            products={products}
            onChange={(defaultValue) => updateFieldState({ defaultValue })}
          />
        ) : null}

        {isInputField ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Pakollinen</Text>
            <AppSwitch
              value={field.required}
              onValueChange={(required) => updateFieldState({ required })}
            />
          </View>
        ) : null}

        {isInputField && formDebug.enabled ? (
          field.type === 'select' ? (
            <AppPicker
              label="Debug-esimerkki (valinta)"
              selectedValue={field.debugExampleValue ?? ''}
              onValueChange={(value) => updateFieldState({ debugExampleValue: value })}
              placeholder="Valitse..."
              allowEmpty
              items={(field.options ?? []).map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          ) : isProductField(field) ? (
            <AppPicker
              label="Debug-esimerkki (tuote)"
              selectedValue={field.debugExampleValue ?? ''}
              onValueChange={(value) => updateFieldState({ debugExampleValue: value })}
              placeholder="Valitse tuote..."
              allowEmpty
              items={products.map((product) => ({
                value: product.id,
                label: product.name,
              }))}
            />
          ) : field.type === 'boolean' ? (
            <AppPicker
              label="Debug-esimerkki"
              selectedValue={field.debugExampleValue ?? 'false'}
              onValueChange={(value) => updateFieldState({ debugExampleValue: value })}
              items={[
                { label: 'Ei', value: 'false' },
                { label: 'Kyllä', value: 'true' },
              ]}
            />
          ) : (
            <AppInput
              label="Debug-esimerkkiarvo"
              value={field.debugExampleValue ?? ''}
              onChangeText={(debugExampleValue) => updateFieldState({ debugExampleValue })}
              placeholder={field.type === 'number' ? 'Esim. 120' : 'Esimerkkiarvo'}
              keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
              compact
            />
          )
        ) : null}

        {field.type !== 'section' ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Näytä yhteenvetolomakkeella</Text>
            <AppSwitch
              value={field.showOnSummary}
              onValueChange={(showOnSummary) => updateFieldState({ showOnSummary })}
            />
          </View>
        ) : null}

        {!isSystem && field.type !== 'section' && field.showOnSummary ? (
          <FieldVisibilityEditor
            form={previewForm}
            field={field}
            condition={field.showOnSummaryWhen}
            title="Yhteenvedon ehto"
            help="Näytä kenttä yhteenvedossa vain kun ehto täyttyy. Wizardissa kenttä pysyy näkyvissä (ellei wizardin näkyvyysehto piilota sitä)."
            switchLabel="Näytä yhteenvedossa vain jos ehto täyttyy"
            onChange={(showOnSummaryWhen) => {
              setField((current) => {
                if (!current) return current;
                if (!showOnSummaryWhen) {
                  const { showOnSummaryWhen: _removed, ...rest } = current;
                  return rest;
                }
                return { ...current, showOnSummaryWhen };
              });
            }}
          />
        ) : null}

        <AppInput
          label="Ohjeteksti (valinnainen)"
          value={field.helpText ?? ''}
          onChangeText={(helpText) => updateFieldState({ helpText })}
          multiline
          placeholder="Näytetään kentän alla laskennassa"
          compact
        />

        {formDebug.enabled && isComputed ? (
          <FormulaDebugPanel
            form={previewForm}
            focusFieldKey={field.key}
            formula={field.formula}
            showIntermediateSteps={formDebug.showIntermediateSteps}
            settings={settings}
            products={products}
          />
        ) : null}

        {!formDebug.enabled && isComputed ? (
          <Text style={styles.disabledHint}>
            Ota debug-tila käyttöön (Lomakeasetukset → Debug) nähdäksesi live-laskennan.
          </Text>
        ) : null}

        <PrimaryButton title="Tallenna" onPress={handleSave} />
        {!isSystem && !isUnsavedDraft ? (
          <OutlinedButton title="Kopioi kenttä" onPress={() => void handleDuplicate()} />
        ) : null}
        {!isSystem && !isUnsavedDraft ? (
          <OutlinedButton title="Poista kenttä" onPress={() => setDeleteVisible(true)} />
        ) : null}
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

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 4,
    },
    help: {
      marginBottom: 8,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 20,
    },
    systemBadge: {
      marginBottom: 8,
      padding: 10,
      borderRadius: 5,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accent,
      fontFamily: 'IBMPlexSans_500Medium',
      color: colors.accent,
      fontSize: 13,
    },
    metaLine: {
      marginBottom: 8,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
    },
    formulaReadonly: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      marginBottom: 8,
      paddingBottom: 8,
    },
    formulaText: {
      paddingHorizontal: 12,
      paddingBottom: 4,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 18,
      fontSize: 14,
    },
    formulaHint: {
      marginTop: -4,
      marginBottom: 10,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      opacity: 0.75,
      fontSize: 13,
      lineHeight: 18,
    },
    switchRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginVertical: 8,
      gap: 12,
    },
    switchLabel: {
      flex: 1,
      fontFamily: 'IBMPlexSans_500Medium',
      color: colors.text,
    },
    disabledHint: {
      marginTop: 12,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 20,
    },
  };
}
