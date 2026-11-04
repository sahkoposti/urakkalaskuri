import { Pressable, Text, View } from 'react-native';

import { DETAIL_TABS, type DetailTab } from '@/src/components/pdf/pdfExportFormModel';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type DetailTabBarProps = {
  value: DetailTab;
  onChange: (tab: DetailTab) => void;
};

/** [Laskelma | Dokumentit]. Paikallinen tila, ei uutta reittiä. */
export function DetailTabBar({ value, onChange }: DetailTabBarProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.row} accessibilityRole="tablist">
      {DETAIL_TABS.map((tab) => {
        const active = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={[styles.tab, active && styles.tabActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    row: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    tab: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      paddingVertical: 12,
      alignItems: 'center' as const,
      backgroundColor: colors.secondary,
    },
    tabActive: {
      backgroundColor: colors.accent,
    },
    label: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
    },
    labelActive: {
      color: colors.secondary,
    },
  };
}
