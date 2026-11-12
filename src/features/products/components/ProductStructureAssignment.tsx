import { Text, View } from 'react-native';

import { AppSwitch } from '@/src/components/common';
import type { ProductStructure } from '@/src/core/structure/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type ProductStructureAssignmentProps = {
  structures: ProductStructure[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ProductStructureAssignment({
  structures,
  selectedIds,
  onChange,
}: ProductStructureAssignmentProps) {
  const styles = useThemedStyles(createStyles);
  const selected = new Set(selectedIds);

  function toggle(id: string, enabled: boolean) {
    if (enabled) {
      onChange([...selectedIds, id]);
      return;
    }
    onChange(selectedIds.filter((item) => item !== id));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Tuoterakenteet</Text>
      {structures.length === 0 ? (
        <Text style={styles.empty}>Ei tuoterakenteita. Lisää rakenne asetuksista.</Text>
      ) : (
        structures.map((structure) => (
          <View key={structure.id} style={styles.row}>
            <Text style={styles.name}>{structure.name}</Text>
            <AppSwitch
              value={selected.has(structure.id)}
              onValueChange={(value) => toggle(structure.id, value)}
            />
          </View>
        ))
      )}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      marginTop: 8,
      marginBottom: 8,
      gap: 8,
    },
    label: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 13,
      color: colors.text,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 20,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.secondary,
    },
    name: {
      flex: 1,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
    },
  };
}
