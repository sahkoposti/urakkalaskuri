import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/src/theme/colors';

type ReorderButtonsProps = {
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
};

export function ReorderButtons({ index, count, onMove }: ReorderButtonsProps) {
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
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    width: 36,
    height: 36,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.secondary,
  },
  moveButtonDisabled: {
    opacity: 0.35,
  },
  moveButtonText: {
    color: AppColors.accent,
    fontSize: 18,
    fontFamily: 'IBMPlexSans_700Bold',
    lineHeight: 20,
  },
});
