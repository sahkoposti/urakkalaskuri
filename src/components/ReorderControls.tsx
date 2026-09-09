import { Pressable, Text, View } from 'react-native';

import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type ReorderControlsProps = {
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onDelete?: () => void;
  deleteLabel?: string;
};

export function ReorderControls({
  index,
  count,
  onMove,
  onDelete,
  deleteLabel = 'Poista',
}: ReorderControlsProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.actions}>
      <Pressable
        style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
        disabled={index === 0}
        onPress={() => onMove(-1)}
      >
        <Text style={styles.moveButtonText}>↑</Text>
      </Pressable>
      <Pressable
        style={[styles.moveButton, index === count - 1 && styles.moveButtonDisabled]}
        disabled={index === count - 1}
        onPress={() => onMove(1)}
      >
        <Text style={styles.moveButtonText}>↓</Text>
      </Pressable>
      {onDelete ? (
        <Pressable style={styles.deleteButton} onPress={onDelete}>
          <Text style={styles.deleteButtonText}>{deleteLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    actions: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    moveButton: {
      width: 36,
      height: 36,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.accent,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.secondary,
    },
    moveButtonDisabled: {
      opacity: 0.35,
    },
    moveButtonText: {
      color: colors.accent,
      fontSize: 18,
      fontFamily: 'IBMPlexSans_700Bold',
      lineHeight: 20,
    },
    deleteButton: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    deleteButtonText: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
    },
  };
}
