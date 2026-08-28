import { Pressable, Text, View } from 'react-native';

import { AppInput, OutlinedButton } from '@/src/components/common';
import type { SelectOption } from '@/src/core/form/types';
import { createSelectOption } from '@/src/core/form/formMutations';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type SelectOptionsEditorProps = {
  fieldKey: string;
  options: SelectOption[];
  onChange: (options: SelectOption[]) => void;
};

export function SelectOptionsEditor({ fieldKey, options, onChange }: SelectOptionsEditorProps) {
  const styles = useThemedStyles(createStyles);

  function updateOption(index: number, patch: Partial<SelectOption>) {
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  }

  function addOption() {
    onChange([...options, createSelectOption(`Vaihtoehto ${options.length + 1}`)]);
  }

  function removeOption(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  function moveOption(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Valinnat</Text>
      <Text style={styles.help}>
        Kaavoissa käytetään kentän muuttujaa ({fieldKey}). Valitun vaihtoehdon arvo tulee laskentaan.
      </Text>

      {options.length === 0 ? (
        <Text style={styles.empty}>Ei valintoja. Lisää vähintään yksi.</Text>
      ) : (
        options.map((option, index) => (
          <View key={index} style={styles.optionCard}>
            <View style={styles.optionHeader}>
              <Text style={styles.optionIndex}>{index + 1}.</Text>
              <View style={styles.optionActions}>
                <Pressable
                  style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                  disabled={index === 0}
                  onPress={() => moveOption(index, -1)}
                >
                  <Text style={styles.moveButtonText}>↑</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.moveButton,
                    index === options.length - 1 && styles.moveButtonDisabled,
                  ]}
                  disabled={index === options.length - 1}
                  onPress={() => moveOption(index, 1)}
                >
                  <Text style={styles.moveButtonText}>↓</Text>
                </Pressable>
                <Pressable style={styles.removeButton} onPress={() => removeOption(index)}>
                  <Text style={styles.removeButtonText}>Poista</Text>
                </Pressable>
              </View>
            </View>

            <AppInput
              label="Nimi"
              value={option.label}
              onChangeText={(label) => updateOption(index, { label })}
              compact
            />
            <AppInput
              label="Arvo"
              value={option.value}
              onChangeText={(value) => updateOption(index, { value: value.replace(',', '.') })}
              keyboardType="decimal-pad"
              placeholder="1.15"
              compact
            />
          </View>
        ))
      )}

      <OutlinedButton title="Lisää valinta" onPress={addOption} />
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
      marginBottom: 4,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      marginBottom: 8,
    },
    optionCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      padding: 8,
      marginBottom: 4,
    },
    optionHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 4,
    },
    optionIndex: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.accent,
      fontSize: 15,
    },
    optionActions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
    },
    moveButton: {
      width: 32,
      height: 32,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    moveButtonDisabled: {
      opacity: 0.35,
    },
    moveButtonText: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 16,
    },
    removeButton: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    removeButtonText: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 13,
    },
  };
}
