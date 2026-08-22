import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { AppColors } from '@/src/theme/colors';

type BrandLogoProps = {
  fontSize?: number;
};

export function BrandLogo({ fontSize = 28 }: BrandLogoProps) {
  return (
    <Text style={[styles.logo, { fontSize }]}>
      <Text style={styles.colorPart}>COLOR</Text>
      <Text style={styles.ajatonPart}>AJATON</Text>
    </Text>
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
};

export function ResultRow({ label, value, highlight = false }: ResultRowProps) {
  return (
    <View style={styles.resultRow}>
      <Text style={[styles.resultLabel, highlight && styles.resultHighlight]}>{label}</Text>
      <Text style={[styles.resultValue, highlight && styles.resultValueHighlight]}>{value}</Text>
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
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  multiline?: boolean;
  placeholder?: string;
};

export function AppInput({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  multiline = false,
  placeholder,
}: AppInputProps) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#999"
        style={[styles.input, multiline && styles.inputMultiline]}
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
  logo: {
    fontFamily: 'IBMPlexSans_700Bold',
    textAlign: 'center',
  },
  colorPart: {
    color: AppColors.primary,
    fontFamily: 'IBMPlexSans_700Bold',
  },
  ajatonPart: {
    color: AppColors.accent,
    fontFamily: 'IBMPlexSans_700Bold',
  },
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
    flex: 1,
    textAlign: 'right',
    color: AppColors.primary,
    fontFamily: 'IBMPlexSans_600SemiBold',
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
  inputLabel: {
    marginBottom: 6,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
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
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
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
