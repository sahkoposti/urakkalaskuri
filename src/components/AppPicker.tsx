import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { pickerDisplayLabel, type AppPickerItem } from '@/src/components/pickerDisplayLabel';

export type { AppPickerItem };
export { pickerDisplayLabel };

type AppPickerProps = {
  label?: string;
  selectedValue: string;
  onValueChange: (value: string) => void;
  items: AppPickerItem[];
  placeholder?: string;
  /** Näytä ”Valitse...” -rivi, joka tyhjentää valinnan. */
  allowEmpty?: boolean;
};

export function AppPicker({
  label,
  selectedValue,
  onValueChange,
  items,
  placeholder = 'Valitse...',
  allowEmpty = false,
}: AppPickerProps) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const display = pickerDisplayLabel(items, selectedValue, placeholder);
  const hasSelection = items.some((item) => item.value === selectedValue);

  function handleSelect(value: string) {
    onValueChange(value);
    setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.closed, pressed && styles.closedPressed]}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${display}` : display}
      >
        <Text
          style={[styles.closedText, !hasSelection && styles.placeholderText]}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropPressable} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {allowEmpty ? (
                <Pressable
                  onPress={() => handleSelect('')}
                  style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      !hasSelection && styles.optionTextSelected,
                    ]}
                  >
                    {placeholder}
                  </Text>
                </Pressable>
              ) : null}
              {items.map((item, index) => {
                const selected = item.value === selectedValue;
                return (
                  <Pressable
                    key={`${item.value}-${index}`}
                    onPress={() => handleSelect(item.value)}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      marginBottom: 8,
    },
    label: {
      marginBottom: 6,
      paddingHorizontal: 0,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
      fontSize: 14,
    },
    closed: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.secondary,
      paddingHorizontal: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    closedPressed: {
      opacity: 0.85,
    },
    closedText: {
      flex: 1,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 16,
    },
    placeholderText: {
      color: '#999',
    },
    chevron: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.accent,
      fontSize: 16,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 24,
    },
    backdropPressable: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      width: '100%' as const,
      maxWidth: 400,
      maxHeight: '70%' as const,
      backgroundColor: colors.secondary,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
    },
    sheetTitle: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
      fontSize: 16,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    list: {
      flexGrow: 0,
    },
    option: {
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    optionPressed: {
      backgroundColor: colors.surface,
    },
    optionText: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 16,
    },
    optionTextSelected: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
    },
  };
}
