import { Picker } from '@react-native-picker/picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isProductField } from '@/src/core/form/productFieldUtils';
import type { FieldEffect, FormDefinition, FormField } from '@/src/core/form/types';
import { AppColors } from '@/src/theme/colors';

const EFFECT_TYPES: { type: FieldEffect['type']; label: string }[] = [
  { type: 'add_material', label: 'Lisää materiaalirivi' },
  { type: 'add_material_fixed', label: 'Kiinteä materiaalilisä (€)' },
  { type: 'multiply_materials', label: 'Kerro materiaalit' },
  { type: 'multiply_duration', label: 'Kerro kesto' },
  { type: 'add_duration', label: 'Lisää kesto (h)' },
];

function effectLabel(type: FieldEffect['type']): string {
  return EFFECT_TYPES.find((item) => item.type === type)?.label ?? type;
}

function productSourceFields(form: FormDefinition): FormField[] {
  return form.fields.filter(isProductField);
}

function quantitySourceFields(form: FormDefinition): FormField[] {
  return form.fields.filter(
    (field) => field.type === 'number' || field.type === 'computed' || field.type === 'select',
  );
}

function defaultEffect(type: FieldEffect['type'], field: FormField, form: FormDefinition): FieldEffect {
  const products = productSourceFields(form);
  const quantities = quantitySourceFields(form);
  const ownQuantity = field.type === 'number' || field.type === 'computed' || field.type === 'select';

  if (type === 'add_material') {
    return {
      type,
      productRef: isProductField(field) ? field.key : products[0]?.key,
      quantityRef: ownQuantity ? field.key : quantities[0]?.key,
    };
  }

  return {
    type,
    quantityRef: ownQuantity ? field.key : quantities[0]?.key,
  };
}

type FieldEffectsEditorProps = {
  form: FormDefinition;
  field: FormField;
  onChange: (effects: FieldEffect[]) => void;
};

export function FieldEffectsEditor({ form, field, onChange }: FieldEffectsEditorProps) {
  const effects = field.effects ?? [];
  const products = productSourceFields(form);
  const quantities = quantitySourceFields(form);

  function updateEffect(index: number, patch: Partial<FieldEffect>) {
    onChange(effects.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)));
  }

  function addEffect(type: FieldEffect['type']) {
    onChange([...effects, defaultEffect(type, field, form)]);
  }

  function removeEffect(index: number) {
    onChange(effects.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Vaikutukset laskentaan</Text>
      <Text style={styles.help}>
        Tuotelista ei lisää riviä itsestään. Liitä valittu tuote materiaaleihin määrän kautta
        (esim. pinta-ala / menekki).
      </Text>

      {effects.length === 0 ? (
        <Text style={styles.empty}>Ei vaikutuksia.</Text>
      ) : (
        effects.map((effect, index) => (
          <View key={`${effect.type}-${index}`} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{effectLabel(effect.type)}</Text>
              <Pressable onPress={() => removeEffect(index)}>
                <Text style={styles.removeText}>Poista</Text>
              </Pressable>
            </View>

            {effect.type === 'add_material' ? (
              <View style={styles.pickerWrap}>
                <Text style={styles.pickerLabel}>Tuote</Text>
                <Picker
                  selectedValue={effect.productRef ?? ''}
                  onValueChange={(value) => updateEffect(index, { productRef: value })}
                >
                  <Picker.Item label="Valitse tuotekenttä..." value="" />
                  {products.map((productField) => (
                    <Picker.Item
                      key={productField.id}
                      label={`${productField.label} (${productField.key})`}
                      value={productField.key}
                    />
                  ))}
                </Picker>
              </View>
            ) : null}

            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>
                {effect.type === 'add_material'
                  ? 'Määrä'
                  : effect.type === 'add_material_fixed'
                    ? 'Lisä (€)'
                    : effect.type === 'add_duration'
                      ? 'Lisäys (h)'
                      : 'Kerroin'}
              </Text>
              <Picker
                selectedValue={effect.quantityRef ?? ''}
                onValueChange={(value) => updateEffect(index, { quantityRef: value })}
              >
                <Picker.Item label="Valitse kenttä..." value="" />
                {quantities.map((quantityField) => (
                  <Picker.Item
                    key={quantityField.id}
                    label={`${quantityField.label} (${quantityField.key})`}
                    value={quantityField.key}
                  />
                ))}
              </Picker>
            </View>
          </View>
        ))
      )}

      {products.length === 0 ? (
        <Text style={styles.hint}>Luo ensin Tuotelista-kenttä, jotta voit lisätä materiaalirivin.</Text>
      ) : null}

      <View style={styles.pickerWrap}>
        <Text style={styles.pickerLabel}>Lisää vaikutus</Text>
        <Picker selectedValue="" onValueChange={(value) => value && addEffect(value as FieldEffect['type'])}>
          <Picker.Item label="Valitse…" value="" />
          {EFFECT_TYPES.map((item) => (
            <Picker.Item key={item.type} label={item.label} value={item.type} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  heading: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 16,
    color: AppColors.primary,
  },
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  empty: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
  },
  hint: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    padding: 8,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
    fontSize: 14,
  },
  removeText: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
  },
  pickerWrap: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 4,
  },
  pickerLabel: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
    fontSize: 14,
  },
});
