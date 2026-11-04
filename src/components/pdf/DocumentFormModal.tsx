import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type DocumentFormModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Yhden dokumentin lomake. Suljetaan taustasta, otsikon painikkeesta tai paluusta. */
export function DocumentFormModal({ visible, title, onClose, children }: DocumentFormModalProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onClose} accessibilityLabel="Sulje" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Sulje" hitSlop={8}>
              <Text style={styles.close}>Sulje</Text>
            </Pressable>
          </View>
          <View style={styles.underline} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
    },
    backdropPressable: { ...StyleSheet.absoluteFillObject },
    sheet: {
      width: '100%' as const,
      height: '88%' as const,
      backgroundColor: colors.secondary,
      borderTopLeftRadius: 5,
      borderTopRightRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 12,
    },
    title: {
      flex: 1,
      fontSize: 20,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    close: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 15,
      color: colors.accent,
    },
    underline: {
      marginTop: 8,
      marginBottom: 12,
      width: 40,
      height: 3,
      backgroundColor: colors.accent,
    },
    list: {
      flex: 1,
    },
    content: {
      paddingBottom: 12,
    },
  };
}
