import {
  Pressable,
  Text,
  View,
  type Insets,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type ChoiceToggleOption<T extends string | boolean> = {
  value: T;
  label: string;
};

type ChoiceToggleProps<T extends string | boolean> = {
  label: string;
  value: T;
  options: ChoiceToggleOption<T>[];
  onChange: (value: T) => void;
  /** Vain kutsuja: ylimääräiset tyylit pystytiivistykseen. */
  spacingOverrides?: {
    row?: StyleProp<ViewStyle>;
    label?: StyleProp<TextStyle>;
    button?: StyleProp<ViewStyle>;
    /** Vain kutsuja: laajentaa painikkeen kosketusaluetta ilman layout-korkeutta. */
    buttonHitSlop?: Insets;
  };
};

export function ChoiceToggle<T extends string | boolean>({
  label,
  value,
  options,
  onChange,
  spacingOverrides,
}: ChoiceToggleProps<T>) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.toggleRow, ...(spacingOverrides?.row ? [spacingOverrides.row] : [])]}>
      <Text style={[styles.toggleLabel, ...(spacingOverrides?.label ? [spacingOverrides.label] : [])]}>{label}</Text>
      <View style={styles.toggleActions}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              style={[
                styles.toggleButton,
                ...(spacingOverrides?.button ? [spacingOverrides.button] : []),
                active && styles.toggleButtonActive,
              ]}
              hitSlop={spacingOverrides?.buttonHitSlop}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.toggleButtonText, active && styles.toggleButtonTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    toggleRow: {
      marginBottom: 12,
    },
    toggleLabel: {
      marginBottom: 6,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
    },
    toggleActions: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    toggleButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      paddingVertical: 12,
      alignItems: 'center' as const,
      backgroundColor: colors.secondary,
    },
    toggleButtonActive: {
      backgroundColor: colors.accent,
    },
    toggleButtonText: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
    },
    toggleButtonTextActive: {
      color: colors.secondary,
    },
  };
}
