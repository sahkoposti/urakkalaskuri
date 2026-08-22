import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/src/theme/colors';

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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: AppColors.secondary,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.border,
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
    color: AppColors.primary,
  },
  underline: {
    marginTop: 8,
    marginBottom: 12,
    width: 40,
    height: 3,
    backgroundColor: AppColors.accent,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    marginBottom: 20,
  },
  buttons: {
    gap: 10,
  },
  buttonBase: {
    borderRadius: 5,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: AppColors.accent,
  },
  buttonOutlined: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.accent,
  },
  buttonDestructive: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.accent,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'IBMPlexSans_600SemiBold',
  },
  buttonTextPrimary: {
    color: AppColors.secondary,
  },
  buttonTextOutlined: {
    color: AppColors.accent,
  },
  buttonTextDestructive: {
    color: AppColors.accent,
  },
});
