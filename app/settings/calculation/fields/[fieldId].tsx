import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
import {
  applyPrintEditorChange,
  canPrintOnUrakkakortti,
  isPrintEditable,
  legacyToExplicitState,
  printWhenOptions,
  quantityKeyOptions,
  readPrintEditorState,
  stateForTypeChange,
  type PrintEditorState,
  type TargetEditorState,
} from '@/src/core/form/printEditorState';
import { MATERIALS_CONTEXT_KEY } from '@/src/core/form/systemFields';
import { isProductField } from '@/src/core/form/productFieldUtils';
import { isFieldEffectComplete } from '@/src/core/form/fieldEffects';
import { parseNumber } from '@/src/core/utils/formatters';
import { isSystemField, isSystemFieldHiddenFromUi, restoreSystemField } from '@/src/core/form/systemFields';
import type { FieldType, FormDefinition, FormField, PrintGroup, PrintWhen } from '@/src/core/form/types';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
import { useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useStructureFormEditor } from '@/src/hooks/useStructureFormEditor';
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

function applyFieldTypeChange(current: FormField, type: FieldType, form: FormDefinition): FormField {
  const next: FormField = {
    ...current,
    type,
    required: type !== 'section' && type !== 'computed' ? current.required : false,
  };

  let updated: FormField;
  if (type === 'select') {
    updated = {
      ...next,
      options: current.options?.length ? current.options : [createSelectOption('Vaihtoehto 1')],
    };
  } else if (type === 'computed') {
    updated = { ...next, formula: current.formula ?? '', showOnSummary: true, allowManualOverride: true };
  } else if (type === 'section') {
    const {
      options: _options,
      formula: _formula,
      sameRowAsPrevious: _sameRow,
      ...rest
    } = next;
    updated = rest as FormField;
  } else if (type === 'number' && !next.unit) {
    updated = { ...next, unit: '' };
  } else {
    const { options: _options, formula: _formula, ...rest } = next;
    updated = rest as FormField;
  }

  // Legacy stays legacy. Explicit print is rewritten so ifYes / quantityKey match the new type.
  const printState = stateForTypeChange(current, updated, form);
  if (!printState) return updated;
  return applyPrintEditorChange(updated, form, printState);
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
  const { ready, formDebug, settings, products } = useApp();
  const { formDefinition, persistForm, href, structure } = useStructureFormEditor();
  const { showAlert } = useThemedAlert();
  const [field, setField] = useState<FormField | null>(null);
  const [savedField, setSavedField] = useState<FormField | null>(null);
  const [draftForm, setDraftForm] = useState<FormDefinition>(
    formDefinition ?? { id: '', name: '', version: 0, pages: [], fields: [], updatedAt: 0 },
  );
  const [deleteVisible, setDeleteVisible] = useState(false);
  const draftInitRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !formDefinition) return;
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
    if (!field || !formDefinition) return false;
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
    await persistForm(nextForm);
    setSavedField(field);
    setDraftForm(nextForm);
    return true;
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistSettings,
  });

  if (!ready) return <ScreenLoading />;
  if (!formDefinition) return <ScreenMessage message="Tuoterakennetta ei löytynyt." />;
  if (!field) return <ScreenMessage message="Kenttää ei löytynyt." />;
  if (isSystemFieldHiddenFromUi(field)) {
    return <ScreenMessage message="Tätä järjestelmäkenttää ei voi muokata. Se on käytössä vain laskennassa." />;
  }

  const structureForm = formDefinition;

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
      href(`/settings/calculation/fields/${copyId}?draft=1&duplicateFrom=${editingField.id}`),
    );
  }

  async function handleDelete() {
    const next = removeField(structureForm, editingField.id);
    await persistForm(next);
    allowExit();
    setDeleteVisible(false);
    router.back();
  }

  function updateFieldState(patch: Partial<FormField>) {
    setField((current) => (current ? { ...current, ...patch } : current));
  }

  function handleTypeChange(type: FieldType) {
    setField((current) => (current ? applyFieldTypeChange(current, type, previewForm) : current));
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

        {field.type !== 'section' ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Rivitä edelliselle riville</Text>
            <AppSwitch
              value={Boolean(field.sameRowAsPrevious)}
              onValueChange={(enabled) => {
                setField((current) => {
                  if (!current) return current;
                  if (!enabled) {
                    const { sameRowAsPrevious: _removed, ...rest } = current;
                    return rest;
                  }
                  return { ...current, sameRowAsPrevious: true };
                });
              }}
            />
          </View>
        ) : null}
        {field.type !== 'section' ? (
          <Text style={styles.help}>
            Jos valittu, kenttä näytetään samalla rivillä kuin edellinen näkyvä kenttä sivulla.
            Kaksi kenttää jakaa rivin tasan, kolme ⅓ jne. Järjestys tulee sivun kenttälistasta.
          </Text>
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

        {isPrintEditable(field) ? (
          <PrintSettingsEditor
            field={field}
            form={previewForm}
            onChange={(next) => setField(next)}
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
            settings={structure ? settingsForStructure(settings, structure) : settings}
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
    printSection: {
      marginTop: 12,
      marginBottom: 8,
      gap: 4,
    },
    printHeading: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 16,
      color: colors.primary,
    },
    printNote: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
    extrasToggle: {
      marginTop: 4,
      paddingVertical: 8,
    },
    extrasToggleText: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
    },
    targetBlock: {
      marginTop: 4,
      marginBottom: 8,
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.surface,
      gap: 4,
    },
    targetHeading: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
      marginBottom: 4,
    },
  };
}

const WHEN_LABELS: Record<PrintWhen, string> = {
  always: 'Aina',
  notEmpty: 'Kun täytetty',
  ifYes: 'Vain kun Kyllä',
};

const GROUP_LABELS: Record<PrintGroup, string> = {
  osa_alueet: 'Osa-alueet',
  tyovaiheet: 'Työvaiheet',
  muuta: 'Muuta',
  tieto: 'Tieto (oletus)',
  maali: 'Maali',
};

const OFFER_GROUPS: readonly PrintGroup[] = ['osa_alueet', 'tyovaiheet', 'muuta', 'tieto'];
const ALL_GROUPS: readonly PrintGroup[] = ['osa_alueet', 'tyovaiheet', 'muuta', 'tieto', 'maali'];

function groupChoices(target: 'offer' | 'urakkakortti', current: PrintGroup): PrintGroup[] {
  const choices = target === 'offer' ? [...OFFER_GROUPS] : [...ALL_GROUPS];
  if (target === 'offer' && current === 'maali') choices.push('maali');
  return choices;
}

function parseStrictOrder(value: string): number | undefined | null {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (!/^-?\d+(?:[.,]\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function PrintOrderField({
  order,
  onOrderChange,
}: {
  order: number | undefined;
  onOrderChange: (order: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (order === undefined ? '' : String(order).replace('.', ','));
  return (
    <AppInput
      label="Järjestys"
      value={shown}
      placeholder="Lomakkeen järjestys"
      keyboardType="decimal-pad"
      compact
      onChangeText={(value) => {
        setDraft(value);
        const parsed = parseStrictOrder(value);
        if (parsed === null) return;
        if (parsed === order) return;
        onOrderChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function PrintSettingsEditor({
  field,
  form,
  onChange,
}: {
  field: FormField;
  form: FormDefinition;
  onChange: (field: FormField) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const [extrasOpen, setExtrasOpen] = useState(false);

  useEffect(() => {
    setExtrasOpen(false);
  }, [field.id]);

  const editorState = readPrintEditorState(field, form);
  const cardAllowed = canPrintOnUrakkakortti(field);
  const offerOn = editorState.offer !== null;
  const cardOn = cardAllowed && editorState.urakkakortti !== null;
  const anyOn = offerOn || cardOn;
  const whenOptions = printWhenOptions(field);

  function commit(next: PrintEditorState) {
    const sanitized = cardAllowed ? next : { ...next, urakkakortti: null };
    onChange(applyPrintEditorChange(field, form, sanitized));
  }

  function edit(mutate: (base: PrintEditorState) => PrintEditorState) {
    const base = editorState.legacy ? legacyToExplicitState(field, form) : editorState;
    commit(mutate(base));
  }

  function setTarget(target: 'offer' | 'urakkakortti', enabled: boolean) {
    edit((base) => ({
      ...base,
      [target]: enabled ? { group: 'tieto' } : null,
    }));
  }

  function patchTarget(target: 'offer' | 'urakkakortti', patch: Partial<TargetEditorState>) {
    edit((base) => {
      const current = base[target] ?? { group: 'tieto' as const };
      const next: TargetEditorState = { ...current, ...patch };
      if (next.group !== 'maali') delete next.quantityKey;
      if (patch.when === undefined && Object.prototype.hasOwnProperty.call(patch, 'when')) delete next.when;
      if (patch.label === undefined && Object.prototype.hasOwnProperty.call(patch, 'label')) delete next.label;
      if (patch.order === undefined && Object.prototype.hasOwnProperty.call(patch, 'order')) delete next.order;
      if (patch.quantityKey === undefined && Object.prototype.hasOwnProperty.call(patch, 'quantityKey')) {
        delete next.quantityKey;
      }
      return { ...base, [target]: next };
    });
  }

  function renderTarget(target: 'offer' | 'urakkakortti', settings: TargetEditorState) {
    const groups = groupChoices(target, settings.group);
    return (
      <View key={target} style={styles.targetBlock}>
        <Text style={styles.targetHeading}>{target === 'offer' ? 'Tarjous' : 'Urakkakortti'}</Text>
        <AppPicker
          label="Ehto tällä tulosteella"
          selectedValue={settings.when ?? ''}
          onValueChange={(value) => {
            patchTarget(target, { when: value === '' ? undefined : (value as PrintWhen) });
          }}
          items={[
            { value: '', label: 'Sama kuin yllä' },
            ...whenOptions.map((option) => ({ value: option, label: WHEN_LABELS[option] })),
          ]}
        />
        <AppPicker
          label="Ryhmä"
          selectedValue={settings.group}
          onValueChange={(value) => {
            const group = value as PrintGroup;
            patchTarget(target, {
              group,
              quantityKey: group === 'maali' ? settings.quantityKey : undefined,
            });
          }}
          items={groups.map((group) => ({ value: group, label: GROUP_LABELS[group] }))}
        />
        <PrintOrderField
          key={`${field.id}-${target}-order`}
          order={settings.order}
          onOrderChange={(order) => patchTarget(target, { order })}
        />
        <AppInput
          label="Tulostusteksti"
          value={settings.label === '' ? '' : (settings.label ?? '')}
          onChangeText={(label) => patchTarget(target, { label: label.length === 0 ? undefined : label })}
          placeholder="Kentän nimi"
          compact
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Vain arvo, ei nimeä</Text>
          <AppSwitch
            value={settings.label === ''}
            onValueChange={(enabled) => patchTarget(target, { label: enabled ? '' : undefined })}
          />
        </View>
        {target === 'urakkakortti' && field.type === 'product_select' && settings.group === 'maali' ? (
          <>
            <AppPicker
              label="Määräkenttä"
              selectedValue={settings.quantityKey ?? ''}
              onValueChange={(value) => patchTarget(target, { quantityKey: value || undefined })}
              placeholder="Ei määräkenttää"
              allowEmpty
              items={quantityKeyOptions(form, field).map((option) => ({
                value: option.key,
                label: `${option.label} (${option.key})`,
              }))}
            />
            <Text style={styles.printNote}>Esim. maalin litramäärä urakkakortin materiaaliriville.</Text>
          </>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.printSection}>
      <Text style={styles.printHeading}>Tulostus</Text>
      <Text style={styles.printNote}>
        Valitse, tulostetaanko kenttä tarjoukseen ja urakkakortille. Ei vaikuta laskentaan eikä sovelluksen
        yhteenvetoon.
      </Text>
      {editorState.legacy ? (
        <Text style={styles.printNote}>
          Oletus vanhan asetuksen (Näytä yhteenvetolomakkeella) mukaan. Asetus tallentuu vasta, kun muutat sitä.
        </Text>
      ) : null}
      {editorState.legacy && field.showOnSummaryWhen ? (
        <Text style={styles.printNote}>
          Kun muutat tulostusta, yhteenvedon ehto ei enää vaikuta tulosteisiin.
        </Text>
      ) : null}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Tarjouksessa</Text>
        <AppSwitch value={offerOn} onValueChange={(enabled) => setTarget('offer', enabled)} />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Urakkakortilla</Text>
        <AppSwitch
          value={cardOn}
          disabled={!cardAllowed}
          onValueChange={(enabled) => {
            if (!cardAllowed) return;
            setTarget('urakkakortti', enabled);
          }}
        />
      </View>
      {!cardAllowed ? <Text style={styles.printNote}>€-rivejä ei tulosteta urakkakortille.</Text> : null}

      {anyOn ? (
        <>
          <AppPicker
            label="Näytä"
            selectedValue={whenOptions.includes(editorState.when) ? editorState.when : ''}
            onValueChange={(value) => {
              if (!whenOptions.includes(value as PrintWhen)) return;
              edit((base) => ({ ...base, when: value as PrintWhen }));
            }}
            items={whenOptions.map((option) => ({ value: option, label: WHEN_LABELS[option] }))}
          />
          <Text style={styles.printNote}>Aina: myös Ei / 0 tulostetaan. Tyhjää tekstiä ei tulosteta.</Text>
          <Pressable
            onPress={() => setExtrasOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: extrasOpen }}
            style={styles.extrasToggle}
          >
            <Text style={styles.extrasToggleText}>{extrasOpen ? 'Lisäasetukset ▾' : 'Lisäasetukset ▸'}</Text>
          </Pressable>
          {extrasOpen ? (
            <>
              {offerOn && editorState.offer ? renderTarget('offer', editorState.offer) : null}
              {cardOn && editorState.urakkakortti ? renderTarget('urakkakortti', editorState.urakkakortti) : null}
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
