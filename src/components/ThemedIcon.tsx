import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useAppColors } from '@/src/theme/ThemeContext';

type ThemedIconName = 'reset' | 'trash' | 'chevron-down' | 'chevron-forward' | 'copy' | 'settings';
type IonName = ComponentProps<typeof Ionicons>['name'];

const ION_NAMES: Record<ThemedIconName, IonName> = {
  reset: 'refresh-outline',
  trash: 'trash-outline',
  'chevron-down': 'chevron-down',
  'chevron-forward': 'chevron-forward',
  copy: 'copy-outline',
  settings: 'settings-outline',
};

type ThemedIconProps = {
  name: ThemedIconName;
  size?: number;
  color?: string;
};

/** Teemavärinen vektorikuvake (Ionicons). Toimii Androidilla, iOS:lla ja webissä. */
export function ThemedIcon({ name, size = 22, color }: ThemedIconProps) {
  const colors = useAppColors();
  return <Ionicons name={ION_NAMES[name]} size={size} color={color ?? colors.accent} />;
}
