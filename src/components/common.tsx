import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SymbolView } from 'expo-symbols';

import { AppColors } from '@/src/theme/colors';

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

type SectionTitleProps = {
  title: string;
  center?: boolean;
};

export function SectionTitle({ title, center = false }: SectionTitleProps) {
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
  style?: ViewStyle;
};

export function AppCard({ children, onPress, style }: AppCardProps) {
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
            <SymbolView name="doc.on.doc" size={14} tintColor={AppColors.accent} />
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

type AppInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'phone-pad' | 'email-address';
  multiline?: boolean;
  placeholder?: string;
  compact?: boolean;
};

export function AppInput({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  multiline = false,
  placeholder,
  compact = false,
}: AppInputProps) {
  return (
    <View style={[styles.inputWrap, compact && styles.inputWrapCompact]}>
      <Text style={[styles.inputLabel, compact && styles.inputLabelCompact]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#999"
        style={[
          styles.input,
          compact && styles.inputCompact,
          multiline && styles.inputMultiline,
          compact && multiline && styles.inputMultilineCompact,
        ]}
      />
    </View>
  );
}

export function ScreenLoading() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={AppColors.accent} />
    </View>
  );
}

export function ScreenMessage({ message }: { message: string }) {
  return (
    <View style={styles.loadingWrap}>
      <Text style={styles.messageText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitleWrap: {
    marginBottom: 8,
  },
  centerAlign: {
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 24,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
  },
  centerText: {
    textAlign: 'center',
  },
  sectionUnderline: {
    marginTop: 8,
    width: 40,
    height: 3,
    backgroundColor: AppColors.accent,
  },
  card: {
    backgroundColor: AppColors.secondary,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.border,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  resultLabel: {
    flex: 1.5,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_500Medium',
  },
  resultHighlight: {
    fontFamily: 'IBMPlexSans_700Bold',
  },
  resultValue: {
    flexShrink: 1,
    textAlign: 'right',
    color: AppColors.primary,
    fontFamily: 'IBMPlexSans_600SemiBold',
  },
  resultValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  copyButton: {
    padding: 2,
  },
  copyButtonPressed: {
    opacity: 0.6,
  },
  resultValueHighlight: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_700Bold',
  },
  buttonBase: {
    borderRadius: 5,
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: AppColors.accent,
  },
  outlinedButton: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.accent,
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
    color: AppColors.secondary,
  },
  outlinedButtonText: {
    color: AppColors.accent,
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
    color: AppColors.text,
  },
  inputLabelCompact: {
    marginBottom: 4,
    fontSize: 14,
  },
  input: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.primary,
  },
  inputCompact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  inputMultilineCompact: {
    minHeight: 64,
    paddingVertical: 8,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  messageText: {
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
    textAlign: 'center',
  },
});
