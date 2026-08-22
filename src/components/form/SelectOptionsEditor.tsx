import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput, OutlinedButton } from '@/src/components/common';
import type { SelectOption } from '@/src/core/form/types';
import { createSelectOption, slugifyKey } from '@/src/core/form/formMutations';
import { AppColors } from '@/src/theme/colors';

type SelectOptionsEditorProps = {
  options: SelectOption[];
  defaultExportKey: string;
  onChange: (options: SelectOption[]) => void;
};

export function SelectOptionsEditor({
  options,
  defaultExportKey,
  onChange,
}: SelectOptionsEditorProps) {
  function updateOption(index: number, patch: Partial<SelectOption>) {
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));
  }

  function addOption() {
    const next = createSelectOption(`Vaihtoehto ${options.length + 1}`);
    onChange([...options, { ...next, exportKey: defaultExportKey }]);
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
        Jokainen valinta voi kirjoittaa kertoimen kaavaan export-muuttujalla (esim. laudoituskerroin).
      </Text>

      {options.length === 0 ? (
        <Text style={styles.empty}>Ei valintoja. Lisää vähintään yksi.</Text>
      ) : (
        options.map((option, index) => (
          <View key={`${option.value}-${index}`} style={styles.optionCard}>
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
              onChangeText={(label) => {
                const patch: Partial<SelectOption> = { label };
                if (!option.value || option.value === slugifyKey(option.label)) {
                  patch.value = slugifyKey(label);
                }
                updateOption(index, patch);
              }}
            />
            <AppInput
              label="Arvo (tallennetaan)"
              value={option.value}
              onChangeText={(value) => updateOption(index, { value: slugifyKey(value) })}
              placeholder="esim. paneeli"
            />
            <AppInput
              label="Kerroin"
              value={option.multiplier !== undefined ? String(option.multiplier) : ''}
              onChangeText={(raw) => {
                const parsed = Number.parseFloat(raw.replace(',', '.'));
                updateOption(index, {
                  multiplier: Number.isFinite(parsed) ? parsed : undefined,
                });
              }}
              keyboardType="decimal-pad"
              placeholder="1.15"
            />
            <AppInput
              label="Export-muuttuja (kaavoissa)"
              value={option.exportKey ?? ''}
              onChangeText={(exportKey) => updateOption(index, { exportKey: exportKey.trim() })}
              placeholder={defaultExportKey}
            />
            {option.exportKey && option.multiplier !== undefined ? (
              <Text style={styles.preview}>
                → {option.exportKey} = {option.multiplier}
              </Text>
            ) : null}
          </View>
        ))
      )}

      <OutlinedButton title="Lisää valinta" onPress={addOption} />
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
    marginBottom: 4,
  },
  empty: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    marginBottom: 8,
  },
  optionCard: {
    backgroundColor: AppColors.surface,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    padding: 12,
    marginBottom: 4,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  optionIndex: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.accent,
    fontSize: 15,
  },
  optionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  moveButton: {
    width: 32,
    height: 32,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButtonDisabled: {
    opacity: 0.35,
  },
  moveButtonText: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 16,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  removeButtonText: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
  },
  preview: {
    marginTop: -4,
    marginBottom: 8,
    fontFamily: 'IBMPlexSans_500Medium',
    color: AppColors.accent,
    fontSize: 13,
  },
});
