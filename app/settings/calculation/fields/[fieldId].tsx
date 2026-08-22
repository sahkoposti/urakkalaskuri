import { Picker } from '@react-native-picker/picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { FormulaDebugPanel } from '@/src/components/form/FormulaDebugPanel';
import {
  AppInput,
  OutlinedButton,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import {
  applyFieldType,
  createSelectOption,
  getFieldById,
  removeField,
  setOptionsExportKey,
  updateFieldInForm,
  validateFieldKey,
} from '@/src/core/form/formEditor';
import type { FieldEffect, FieldEffectType, FieldType, FormField, SelectOption } from '@/src/core/form/types';
import {
  EDITABLE_EFFECT_TYPES,
  FIELD_EFFECT_LABELS,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
} from '@/src/core/form/types';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

function optionalNumber(raw: string): number | undefined {
  const parsed = parseNumber(raw);
  return parsed === null ? undefined : parsed;
}

function numberInput(value?: number): string {
  return value === undefined ? '' : String(value).replace('.', ',');
}

export default function FormFieldEditorScreen() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const { ready, formDefinition, formDebug, products, settings, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();
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

  function updateField(patch: Partial<FormField>) {
    setField((current) => (current ? { ...current, ...patch } : current));
  }

  async function handleSave() {
    const keyError = validateFieldKey(previewForm, field!.key, field!.id);
    if (keyError) {
      showAlert('Virhe', keyError);
      return;
    }
    await db.saveFormDefinition(updateFieldInForm(draftForm, field!));
    await refreshFormSettings();
    router.back();
  }

  function handleDelete() {
    showAlert('Poista kenttä', `Poistetaanko kenttä "${field!.label}"?`, [
      { text: 'Peruuta', style: 'cancel' },
      {
        text: 'Poista',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await db.saveFormDefinition(removeField(draftForm, field!.id));
            await refreshFormSettings();
            router.back();
          })();
        },
      },
    ]);
  }

  const isInputField = field.type !== 'computed' && field.type !== 'section';
  const isComputed = field.type === 'computed';
  const pages = [...draftForm.pages].sort((a, b) => a.sortOrder - b.sortOrder);
  const productFields = draftForm.fields.filter(
    (item) => item.type === 'product_select' || item.type === 'product_quantity',
  );
  const quantityFields = draftForm.fields.filter(
    (item) => item.type === 'number' || item.type === 'computed' || item.id === field.id,
  );

  return (
    <>
      <Stack.Screen options={{ title: field.label }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppInput label="Nimi" value={field.label} onChangeText={(label) => updateField({ label })} />
        <AppInput
          label="Muuttuja (key)"
          value={field.key}
          onChangeText={(key) => updateField({ key: key.trim().toLowerCase() })}
          placeholder="esim. pinta_ala"
        />

        <Text style={styles.inputLabel}>Sivu</Text>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={field.pageId} onValueChange={(pageId) => updateField({ pageId })}>
            {pages.map((page) => (
              <Picker.Item key={page.id} label={page.title} value={page.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.inputLabel}>Tyyppi</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={field.type}
            onValueChange={(type) => setField((current) => (current ? applyFieldType(current, type as FieldType) : current))}
          >
            {FIELD_TYPES.map((type) => (
              <Picker.Item key={type} label={FIELD_TYPE_LABELS[type]} value={type} />
            ))}
          </Picker>
        </View>

        {field.type !== 'section' && field.type !== 'boolean' ? (
          <AppInput
            label="Yksikkö"
            value={field.unit ?? ''}
            onChangeText={(unit) => updateField({ unit: unit || undefined })}
            placeholder="esim. m², l, pv"
          />
        ) : null}

        <AppInput
          label="Ohjeteksti"
          value={field.helpText ?? ''}
          onChangeText={(helpText) => updateField({ helpText: helpText || undefined })}
        />

        {isComputed ? (
          <AppInput
            label="Kaava"
            value={field.formula ?? ''}
            onChangeText={(formula) => updateField({ formula })}
            multiline
            placeholder="pinta_ala / tuote.consumption"
          />
        ) : null}

        {isComputed ? (
          <Text style={styles.hint}>
            Funktiot: min(), max(), round(). Desimaali kaavassa pisteellä (1.15). Tuoteattribuutit:
            kenttä.consumption, kenttä.unit_price.
          </Text>
        ) : null}

        {field.type === 'select' ? (
          <SelectOptionsEditor
            field={field}
            onChange={(options) => updateField({ options })}
            onExportKey={(exportKey) => setField((current) => (current ? setOptionsExportKey(current, exportKey) : current))}
          />
        ) : null}

        {isInputField && formDebug.enabled ? (
          <DebugExampleEditor field={field} products={products} onChange={updateField} />
        ) : null}

        {field.type !== 'section' ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Pakollinen</Text>
            <Switch
              value={field.required}
              onValueChange={(required) => updateField({ required })}
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        ) : null}

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Näytä yhteenvetolomakkeella</Text>
          <Switch
            value={field.showOnSummary}
            onValueChange={(showOnSummary) => updateField({ showOnSummary })}
            trackColor={{ true: AppColors.accent, false: AppColors.border }}
          />
        </View>

        {field.type !== 'section' ? (
          <EffectsEditor
            field={field}
            productFields={productFields}
            quantityFields={quantityFields}
            onChange={(effects) => updateField({ effects })}
          />
        ) : null}

        {formDebug.enabled && isComputed ? (
          <FormulaDebugPanel
            form={previewForm}
            focusFieldKey={field.key}
            formula={field.formula}
            products={products}
            settings={settings}
            showIntermediateSteps={formDebug.showIntermediateSteps}
          />
        ) : null}

        {!formDebug.enabled && isComputed ? (
          <Text style={styles.disabledHint}>
            Ota debug-tila käyttöön (Lomakeasetukset → Debug) nähdäksesi live-laskennan.
          </Text>
        ) : null}

        <PrimaryButton title="Tallenna" onPress={() => void handleSave()} />
        <OutlinedButton title="Poista kenttä" onPress={handleDelete} />
      </ScrollView>
    </>
  );
}

type DebugExampleEditorProps = {
  field: FormField;
  products: { id: string; name: string }[];
  onChange: (patch: Partial<FormField>) => void;
};

function DebugExampleEditor({ field, products, onChange }: DebugExampleEditorProps) {
  if (field.type === 'select') {
    return (
      <View style={styles.pickerWrap}>
        <Text style={styles.inputLabel}>Debug-esimerkki (valinta)</Text>
        <Picker
          selectedValue={field.debugExampleValue ?? ''}
          onValueChange={(value) => onChange({ debugExampleValue: value || undefined })}
        >
          <Picker.Item label="Valitse..." value="" />
          {field.options?.map((option) => (
            <Picker.Item key={option.value} label={option.label} value={option.value} />
          ))}
        </Picker>
      </View>
    );
  }

  if (field.type === 'boolean') {
    return (
      <View style={styles.pickerWrap}>
        <Text style={styles.inputLabel}>Debug-esimerkki</Text>
        <Picker
          selectedValue={field.debugExampleValue ?? ''}
          onValueChange={(value) => onChange({ debugExampleValue: value || undefined })}
        >
          <Picker.Item label="Valitse..." value="" />
          <Picker.Item label="Kyllä" value="true" />
          <Picker.Item label="Ei" value="false" />
        </Picker>
      </View>
    );
  }

  if (field.type === 'product_select' || field.type === 'product_quantity') {
    return (
      <View>
        <Text style={styles.inputLabel}>Debug-esimerkki (tuote)</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={
              field.type === 'product_quantity'
                ? (field.debugExampleValue?.split('|')[0] ?? field.productId ?? '')
                : (field.debugExampleValue ?? '')
            }
            onValueChange={(productId) => {
              if (field.type === 'product_quantity') {
                const qty = field.debugExampleValue?.split('|')[1] ?? '1';
                onChange({
                  productId: productId || undefined,
                  debugExampleValue: productId ? `${productId}|${qty}` : undefined,
                });
                return;
              }
              onChange({ debugExampleValue: productId || undefined });
            }}
          >
            <Picker.Item label="Valitse tuote..." value="" />
            {products.map((product) => (
              <Picker.Item key={product.id} label={product.name} value={product.id} />
            ))}
          </Picker>
        </View>
        {field.type === 'product_quantity' ? (
          <AppInput
            label="Debug-määrä"
            value={field.debugExampleValue?.split('|')[1] ?? ''}
            onChangeText={(qty) => {
              const productId = field.debugExampleValue?.split('|')[0] ?? field.productId ?? '';
              onChange({
                debugExampleValue: productId ? `${productId}|${qty}` : qty,
              });
            }}
            keyboardType="decimal-pad"
          />
        ) : null}
      </View>
    );
  }

  return (
    <AppInput
      label="Debug-esimerkkiarvo"
      value={field.debugExampleValue ?? ''}
      onChangeText={(debugExampleValue) => onChange({ debugExampleValue })}
      placeholder={field.type === 'number' ? 'Esim. 120' : 'Esimerkkiarvo'}
      keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
    />
  );
}

type SelectOptionsEditorProps = {
  field: FormField;
  onChange: (options: SelectOption[]) => void;
  onExportKey: (exportKey: string) => void;
};

function SelectOptionsEditor({ field, onChange, onExportKey }: SelectOptionsEditorProps) {
  const options = field.options ?? [];
  return (
    <View style={styles.block}>
      <Text style={styles.section}>Valinnat</Text>
      <AppInput
        label="Vie kerroin muuttujaan"
        value={options[0]?.exportKey ?? ''}
        onChangeText={onExportKey}
        placeholder="esim. laudoituskerroin"
      />
      {options.map((option, index) => (
        <View key={`${option.value}-${index}`} style={styles.optionCard}>
          <AppInput
            label="Nimi"
            value={option.label}
            onChangeText={(label) => {
              const next = [...options];
              next[index] = { ...option, label };
              onChange(next);
            }}
          />
          <AppInput
            label="Arvo"
            value={option.value}
            onChangeText={(value) => {
              const next = [...options];
              next[index] = { ...option, value };
              onChange(next);
            }}
          />
          <AppInput
            label="Kerroin"
            value={numberInput(option.multiplier)}
            onChangeText={(raw) => {
              const next = [...options];
              next[index] = { ...option, multiplier: optionalNumber(raw) };
              onChange(next);
            }}
            keyboardType="decimal-pad"
          />
          <AppInput
            label="Työkerroin"
            value={numberInput(option.workFactor)}
            onChangeText={(raw) => {
              const next = [...options];
              next[index] = { ...option, workFactor: optionalNumber(raw) };
              onChange(next);
            }}
            keyboardType="decimal-pad"
          />
          <AppInput
            label="Materiaalikerroin"
            value={numberInput(option.materialFactor)}
            onChangeText={(raw) => {
              const next = [...options];
              next[index] = { ...option, materialFactor: optionalNumber(raw) };
              onChange(next);
            }}
            keyboardType="decimal-pad"
          />
          <OutlinedButton
            title="Poista valinta"
            onPress={() => onChange(options.filter((_, optionIndex) => optionIndex !== index))}
          />
        </View>
      ))}
      <OutlinedButton
        title="Lisää valinta"
        onPress={() => onChange([...options, createSelectOption(`Valinta ${options.length + 1}`)])}
      />
    </View>
  );
}

type EffectsEditorProps = {
  field: FormField;
  productFields: FormField[];
  quantityFields: FormField[];
  onChange: (effects: FieldEffect[]) => void;
};

function EffectsEditor({ field, productFields, quantityFields, onChange }: EffectsEditorProps) {
  const effects = field.effects ?? [];
  return (
    <View style={styles.block}>
      <Text style={styles.section}>Vaikutukset</Text>
      <Text style={styles.hint}>Valinnainen. Tyhjä = kenttä on vain muuttuja kaavoissa.</Text>
      {effects.map((effect, index) => (
        <View key={`${effect.type}-${index}`} style={styles.optionCard}>
          <Text style={styles.inputLabel}>Tyyppi</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={effect.type}
              onValueChange={(type) => {
                const next = [...effects];
                next[index] = { ...effect, type: type as FieldEffectType };
                onChange(next);
              }}
            >
              {EDITABLE_EFFECT_TYPES.map((type) => (
                <Picker.Item key={type} label={FIELD_EFFECT_LABELS[type]} value={type} />
              ))}
            </Picker>
          </View>

          {effect.type === 'add_material' ? (
            <>
              <Text style={styles.inputLabel}>Tuote (kenttä tai id)</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={effect.productRef ?? ''}
                  onValueChange={(productRef) => {
                    const next = [...effects];
                    next[index] = { ...effect, productRef: productRef || undefined };
                    onChange(next);
                  }}
                >
                  <Picker.Item label="Valitse..." value="" />
                  {productFields.map((item) => (
                    <Picker.Item key={item.id} label={`${item.label} (${item.key})`} value={item.key} />
                  ))}
                </Picker>
              </View>
              <Text style={styles.inputLabel}>Määrä (kenttä)</Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={effect.quantityRef ?? ''}
                  onValueChange={(quantityRef) => {
                    const next = [...effects];
                    next[index] = { ...effect, quantityRef: quantityRef || undefined };
                    onChange(next);
                  }}
                >
                  <Picker.Item label="Valitse..." value="" />
                  {quantityFields.map((item) => (
                    <Picker.Item key={item.id} label={`${item.label} (${item.key})`} value={item.key} />
                  ))}
                </Picker>
              </View>
            </>
          ) : null}

          {effect.type === 'multiply_duration' || effect.type === 'multiply_materials' ? (
            <AppInput
              label="Kerroin"
              value={numberInput(effect.factor)}
              onChangeText={(raw) => {
                const next = [...effects];
                next[index] = { ...effect, factor: optionalNumber(raw) };
                onChange(next);
              }}
              keyboardType="decimal-pad"
            />
          ) : null}

          {effect.type === 'add_duration' || effect.type === 'add_material_fixed' ? (
            <AppInput
              label={effect.type === 'add_duration' ? 'Tunnit' : 'Summa €'}
              value={numberInput(effect.amount)}
              onChangeText={(raw) => {
                const next = [...effects];
                next[index] = { ...effect, amount: optionalNumber(raw) };
                onChange(next);
              }}
              keyboardType="decimal-pad"
            />
          ) : null}

          <OutlinedButton
            title="Poista vaikutus"
            onPress={() => onChange(effects.filter((_, effectIndex) => effectIndex !== index))}
          />
        </View>
      ))}
      <OutlinedButton
        title="Lisää vaikutus"
        onPress={() => onChange([...effects, { type: 'add_material' }])}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    backgroundColor: AppColors.secondary,
    marginBottom: 12,
    overflow: 'hidden',
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
    marginBottom: 12,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 20,
  },
  hint: {
    marginBottom: 12,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  block: {
    marginTop: 8,
    marginBottom: 8,
  },
  section: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
    marginBottom: 8,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    padding: 12,
    marginBottom: 12,
    backgroundColor: AppColors.surface,
  },
});
