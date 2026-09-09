import {
  ActivityIndicator,
  Image,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type SwitchProps,
  type ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { ReactNode } from 'react';

import { ThemedIcon } from '@/src/components/ThemedIcon';
import Slider from '@react-native-community/slider';

import type { AppColorPalette } from '@/src/theme/colors';
import { useAppColors } from '@/src/theme/ThemeContext';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { formatPercent } from '@/src/core/utils/formatters';

type BrandLogoProps = {
  width?: number;
};

const LOGO_ASPECT_RATIO = 1024 / 139;

export function BrandLogo({ width = 260 }: BrandLogoProps) {
  return (
    <Image
      source={require('@/assets/images/logo-colorajaton.png')}
      style={{ width, height: width / LOGO_ASPECT_RATIO }}
      resizeMode="contain"
      accessibilityLabel="ColoRajaton"
    />
  );
}

type BrandIconProps = {
  size?: number;
};

export function BrandIcon({ size = 32 }: BrandIconProps) {
  return (
    <Image
      source={require('@/assets/images/icon-r.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="ColoRajaton"
    />
  );
}

type AppSwitchProps = Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'>;

export function AppSwitch(props: AppSwitchProps) {
  const colors = useAppColors();

  return (
    <Switch
      {...props}
      trackColor={{ false: colors.border, true: colors.accent }}
      thumbColor={colors.secondary}
      ios_backgroundColor={colors.border}
    />
  );
}

type SectionTitleProps = {
  title: string;
  center?: boolean;
};

export function SectionTitle({ title, center = false }: SectionTitleProps) {
  const styles = useThemedStyles(createCommonStyles);
  return (
    <View style={[styles.sectionTitleWrap, center && styles.centerAlign]}>
      <Text style={[styles.sectionTitle, center && styles.centerText]}>{title}</Text>
      <View style={styles.sectionUnderline} />
    </View>
  );
}

type AppCardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function AppCard({ children, onPress, style }: AppCardProps) {
  const styles = useThemedStyles(createCommonStyles);
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && styles.cardPressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

type ResultRowProps = {
  label: string;
  value: string;
  highlight?: boolean;
  copyValue?: string;
  onCopy?: () => void;
};

export function ResultRow({
  label,
  value,
  highlight = false,
  copyValue,
  onCopy,
}: ResultRowProps) {
  const styles = useThemedStyles(createCommonStyles);

  async function handleCopy() {
    const text = copyValue ?? value;
    if (text === '–') return;
    await Clipboard.setStringAsync(text);
    onCopy?.();
  }

  const canCopy = (copyValue ?? value) !== '–';

  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, highlight && styles.resultHighlight]}>{label}</Text>
      <View style={styles.resultValueWrap}>
        <Text style={[styles.resultValue, highlight && styles.resultValueHighlight]}>{value}</Text>
        {canCopy ? (
          <Pressable
            onPress={() => {
              void handleCopy();
            }}
            style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
            accessibilityLabel={`Kopioi ${label}`}
            hitSlop={8}
          >
            <ThemedIcon name="copy" size={16} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export function PrimaryButton({ title, onPress, disabled }: PrimaryButtonProps) {
  return (
    <PressableButton
      title={title}
      onPress={onPress}
      disabled={disabled}
      variant="primary"
    />
  );
}

type OutlinedButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
};

export function OutlinedButton({ title, onPress, disabled }: OutlinedButtonProps) {
  return (
    <PressableButton
      title={title}
      onPress={onPress}
      disabled={disabled}
      variant="outlined"
    />
  );
}

type PressableButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant: 'primary' | 'outlined';
};

function PressableButton({ title, onPress, disabled, variant }: PressableButtonProps) {
  const styles = useThemedStyles(createCommonStyles);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.buttonBase,
        variant === 'primary' ? styles.primaryButton : styles.outlinedButton,
        disabled && styles.buttonDisabled,
        pressed && !disabled ? styles.buttonPressed : null,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' ? styles.primaryButtonText : styles.outlinedButtonText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

type AppPercentSliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function AppPercentSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: AppPercentSliderProps) {
  const styles = useThemedStyles(createCommonStyles);
  const colors = useAppColors();

  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderHeader}>
        <Text style={styles.inputLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{formatPercent(value)}</Text>
      </View>
      <Slider
        value={value}
        onValueChange={onChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

type AppInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  placeholder?: string;
  compact?: boolean;
  trailing?: ReactNode;
};

export function AppInput({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  multiline = false,
  placeholder,
  compact = false,
  trailing,
}: AppInputProps) {
  const styles = useThemedStyles(createCommonStyles);
  const inputStyle = [
    styles.input,
    trailing ? styles.inputBare : null,
    trailing ? styles.inputFlex : null,
    compact && styles.inputCompact,
    multiline && styles.inputMultiline,
    compact && multiline && styles.inputMultilineCompact,
  ];

  const field = (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      multiline={multiline}
      placeholder={placeholder}
      placeholderTextColor="#999"
      style={inputStyle}
    />
  );

  return (
    <View style={[styles.inputWrap, compact && styles.inputWrapCompact]}>
      <Text style={[styles.inputLabel, compact && styles.inputLabelCompact]}>{label}</Text>
      {trailing ? (
        <View style={styles.inputInnerRow}>
          {field}
          {trailing}
        </View>
      ) : (
        field
      )}
    </View>
  );
}

export function ScreenLoading() {
  const styles = useThemedStyles(createCommonStyles);
  const colors = useAppColors();
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}

export function ScreenMessage({ message }: { message: string }) {
  const styles = useThemedStyles(createCommonStyles);
  return (
    <View style={styles.loadingWrap}>
      <Text style={styles.messageText}>{message}</Text>
    </View>
  );
}

function createCommonStyles(colors: AppColorPalette) {
  return {
    sectionTitleWrap: {
      marginBottom: 8,
    },
    centerAlign: {
      alignItems: 'center' as const,
    },
    sectionTitle: {
      fontSize: 24,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    centerText: {
      textAlign: 'center' as const,
    },
    sectionUnderline: {
      marginTop: 8,
      width: 40,
      height: 3,
      backgroundColor: colors.accent,
    },
    card: {
      backgroundColor: colors.secondary,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    cardPressed: {
      opacity: 0.92,
    },
    resultRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      gap: 12,
      paddingVertical: 6,
    },
    resultLabel: {
      flex: 1.5,
      color: colors.text,
      fontFamily: 'IBMPlexSans_500Medium',
    },
    resultHighlight: {
      fontFamily: 'IBMPlexSans_700Bold',
    },
    resultValue: {
      flexShrink: 1,
      textAlign: 'right' as const,
      color: colors.primary,
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
    resultValueWrap: {
      flex: 1,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'flex-end' as const,
      gap: 6,
    },
    copyButton: {
      padding: 2,
    },
    copyButtonPressed: {
      opacity: 0.6,
    },
    resultValueHighlight: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_700Bold',
    },
    buttonBase: {
      borderRadius: 5,
      paddingHorizontal: 32,
      paddingVertical: 16,
      alignItems: 'center' as const,
    },
    primaryButton: {
      backgroundColor: colors.accent,
    },
    outlinedButton: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonText: {
      fontSize: 16,
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
    primaryButtonText: {
      color: colors.secondary,
    },
    outlinedButtonText: {
      color: colors.accent,
    },
    inputWrap: {
      marginBottom: 12,
    },
    inputWrapCompact: {
      marginBottom: 8,
    },
    inputLabel: {
      marginBottom: 6,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
    },
    inputLabelCompact: {
      marginBottom: 4,
      fontSize: 14,
    },
    input: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.primary,
    },
    inputInnerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      paddingRight: 4,
    },
    inputBare: {
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    inputFlex: {
      flex: 1,
    },
    sliderWrap: {
      marginBottom: 12,
    },
    sliderHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 12,
      marginBottom: 4,
    },
    sliderValue: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
      fontSize: 15,
    },
    inputCompact: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 15,
    },
    inputMultiline: {
      minHeight: 90,
      textAlignVertical: 'top' as const,
    },
    inputMultilineCompact: {
      minHeight: 64,
      paddingVertical: 8,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      padding: 24,
    },
    messageText: {
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      textAlign: 'center' as const,
    },
  };
}
