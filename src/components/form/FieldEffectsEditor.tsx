import { Picker } from '@react-native-picker/picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/src/components/common';
import type { FieldEffect, FormDefinition, FormField } from '@/src/core/form/types';
import { parseNumber } from '@/src/core/utils/formatters';
import { AppColors } from '@/src/theme/colors';

const EFFECT_TYPES: { type: FieldEffect['type']; label: string }[] = [
  { type: 'add_material_fixed', label: 'Lisää materiaaleihin' },
  { type: 'multiply_materials', label: 'Kerro materiaaleja' },
  { type: 'add_duration', label: 'Lisää kestoon' },
  { type: 'multiply_duration', label: 'Kerro kestoa' },
];

function effectLabel(type: FieldEffect['type']): string {
  return EFFECT_TYPES.find((item) => item.type === type)?.label ?? type;
}

function effectValueLabel(type: FieldEffect['type']): string {
  switch (type) {
    case 'add_material_fixed':
      return 'Lisä (€)';
    case 'add_duration':
      return 'Lisä (h)';
    case 'multiply_materials':
    case 'multiply_duration':
      return 'Kerroin';
    default:
      return 'Arvo';
  }
}

function effectValuePlaceholder(type: FieldEffect['type']): string {
  switch (type) {
    case 'add_material_fixed':
      return 'esim. 15';
    case 'add_duration':
      return 'esim. 2';
    case 'multiply_materials':
    case 'multiply_duration':
      return 'esim. 1,1';
    default:
      return '';
  }
}

function defaultEffect(type: FieldEffect['type']): FieldEffect {
  return { type };
}

type FieldEffectsEditorProps = {
  form: FormDefinition;
  field: FormField;
  onChange: (effects: FieldEffect[]) => void;
};

export function FieldEffectsEditor({ field, onChange }: FieldEffectsEditorProps) {
  const effects = (field.effects ?? []).filter((effect) => effect.type !== 'add_material');

  function updateEffect(index: number, patch: Partial<FieldEffect>) {
    onChange(effects.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)));
  }

  function addEffect(type: FieldEffect['type']) {
    onChange([...effects, defaultEffect(type)]);
  }

  function removeEffect(index: number) {
    onChange(effects.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Vaikutukset laskentaan</Text>
      <Text style={styles.help}>
        Vaikutukset sovelletaan laskennan lopussa kaavojen jälkeen. Lisää materiaaleihin: kiinteä
        €-summa (alv 0). Kerro materiaaleja / Kerro kestoa: kerroin (1,1 = +10 %). Lisää kestoon:
        tuntien lisäys.
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

            <AppInput
              compact
              label={effectValueLabel(effect.type)}
              value={effect.value !== undefined ? String(effect.value).replace('.', ',') : ''}
              onChangeText={(text) => {
                const parsed = parseNumber(text);
                updateEffect(index, {
                  value: parsed ?? undefined,
                  quantityRef: undefined,
                });
              }}
              keyboardType="decimal-pad"
              placeholder={effectValuePlaceholder(effect.type)}
            />
          </View>
        ))
      )}

      <View style={styles.pickerWrap}>
        <Text style={styles.pickerLabel}>Lisää vaikutus</Text>
        <Picker
          selectedValue=""
          onValueChange={(value) => value && addEffect(value as FieldEffect['type'])}
        >
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
