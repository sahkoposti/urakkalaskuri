import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export type ConfirmDialogButton = {
  title: string;
  variant?: 'primary' | 'outlined' | 'destructive';
  onPress: () => void;
};

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  buttons: ConfirmDialogButton[];
  onClose: () => void;
};

export function ConfirmDialog({ visible, title, message, buttons, onClose }: ConfirmDialogProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.underline} />
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            {buttons.map((button) => (
              <Pressable
                key={button.title}
                onPress={button.onPress}
                style={({ pressed }) => [
                  styles.buttonBase,
                  button.variant === 'primary' && styles.buttonPrimary,
                  button.variant === 'outlined' && styles.buttonOutlined,
                  button.variant === 'destructive' && styles.buttonDestructive,
                  !button.variant && styles.buttonOutlined,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.variant === 'primary' && styles.buttonTextPrimary,
                    button.variant === 'outlined' && styles.buttonTextOutlined,
                    button.variant === 'destructive' && styles.buttonTextDestructive,
                    !button.variant && styles.buttonTextOutlined,
                  ]}
                >
                  {button.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
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
    dialog: {
      width: '100%' as const,
      maxWidth: 340,
      backgroundColor: colors.secondary,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    title: {
      fontSize: 20,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    underline: {
      marginTop: 8,
      marginBottom: 12,
      width: 40,
      height: 3,
      backgroundColor: colors.accent,
    },
    message: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      marginBottom: 20,
    },
    buttons: {
      gap: 10,
    },
    buttonBase: {
      borderRadius: 5,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: 'center' as const,
    },
    buttonPrimary: {
      backgroundColor: colors.accent,
    },
    buttonOutlined: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    buttonDestructive: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    buttonPressed: {
      opacity: 0.9,
    },
    buttonText: {
      fontSize: 16,
      fontFamily: 'IBMPlexSans_600SemiBold',
    },
    buttonTextPrimary: {
      color: colors.secondary,
    },
    buttonTextOutlined: {
      color: colors.accent,
    },
    buttonTextDestructive: {
      color: colors.accent,
    },
  };
}
