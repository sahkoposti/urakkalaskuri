import { Pressable, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { AppInput, AppSwitch } from '@/src/components/common';
import type { FieldEffect, FormDefinition, FormField } from '@/src/core/form/types';
import { parseNumber } from '@/src/core/utils/formatters';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

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

function canUseFieldValue(field: FormField, type: FieldEffect['type']): boolean {
  if (type !== 'add_material_fixed' && type !== 'add_duration') return false;
  return field.type === 'number' || field.type === 'computed' || field.type === 'select';
}

function usesFieldValue(effect: FieldEffect, field: FormField): boolean {
  if (!canUseFieldValue(field, effect.type)) return false;
  if (effect.value !== undefined && Number.isFinite(effect.value)) return false;
  return !effect.quantityRef || effect.quantityRef === field.key;
}

function defaultEffect(type: FieldEffect['type'], field: FormField): FieldEffect {
  if (canUseFieldValue(field, type) && (field.type === 'computed' || field.type === 'number')) {
    return { type };
  }
  return { type };
}

type FieldEffectsEditorProps = {
  form: FormDefinition;
  field: FormField;
  onChange: (effects: FieldEffect[]) => void;
};

export function FieldEffectsEditor({ field, onChange }: FieldEffectsEditorProps) {
  const styles = useThemedStyles(createStyles);
  const effects = (field.effects ?? []).filter(
    (effect) => effect.type !== 'add_material' && (effect.type as string) !== 'set_variable',
  );

  function updateEffect(index: number, patch: Partial<FieldEffect>) {
    onChange(effects.map((effect, i) => (i === index ? { ...effect, ...patch } : effect)));
  }

  function setUseFieldValue(index: number, enabled: boolean) {
    const effect = effects[index];
    if (!effect) return;
    if (enabled) {
      updateEffect(index, { value: undefined, quantityRef: undefined });
      return;
    }
    updateEffect(index, { value: effect.type === 'add_duration' ? 1 : 0, quantityRef: undefined });
  }

  function addEffect(type: FieldEffect['type']) {
    onChange([...effects, defaultEffect(type, field)]);
  }

  function removeEffect(index: number) {
    onChange(effects.filter((_, i) => i !== index));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Vaikutukset laskentaan</Text>
      <Text style={styles.help}>
        Vaikutukset sovelletaan laskennan lopussa kaavojen jälkeen. Lasketulle / numerokentälle
        voit käyttää kentän omaa arvoa (esim. maali_hinta → materiaalit) tai kiinteää lukua.
      </Text>

      {effects.length === 0 ? (
        <Text style={styles.empty}>Ei vaikutuksia.</Text>
      ) : (
        effects.map((effect, index) => {
          const fieldValueMode = usesFieldValue(effect, field);
          const showFieldToggle = canUseFieldValue(field, effect.type);

          return (
            <View key={`${effect.type}-${index}`} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{effectLabel(effect.type)}</Text>
                <Pressable onPress={() => removeEffect(index)}>
                  <Text style={styles.removeText}>Poista</Text>
                </Pressable>
              </View>

              {showFieldToggle ? (
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Käytä tämän kentän arvoa</Text>
                  <AppSwitch
                    value={fieldValueMode}
                    onValueChange={(value) => setUseFieldValue(index, value)}
                  />
                </View>
              ) : null}

              {!fieldValueMode ? (
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
              ) : (
                <Text style={styles.fieldHint}>
                  Arvo tulee kentästä {field.key} kaavojen jälkeen.
                </Text>
              )}
            </View>
          );
        })
      )}

      <AppPicker
        label="Lisää vaikutus"
        selectedValue=""
        placeholder="Valitse…"
        onValueChange={(value) => value && addEffect(value as FieldEffect['type'])}
        items={EFFECT_TYPES.map((item) => ({
          value: item.type,
          label: item.label,
        }))}
      />
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      marginTop: 8,
      marginBottom: 12,
      gap: 8,
    },
    heading: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 16,
      color: colors.primary,
    },
    help: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
    },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      padding: 8,
      gap: 4,
    },
    cardHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 4,
    },
    cardTitle: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
      fontSize: 14,
    },
    removeText: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 13,
    },
    switchRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 12,
      marginBottom: 4,
    },
    switchLabel: {
      flex: 1,
      fontFamily: 'IBMPlexSans_500Medium',
      color: colors.text,
      fontSize: 13,
    },
    fieldHint: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
      marginBottom: 4,
    },
  };
}
