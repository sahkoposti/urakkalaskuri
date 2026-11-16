import type { Insets } from 'react-native';

/** Layout gaps for the calculation edit screen. No other spacing numbers there. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
} as const;

/**
 * Control metrics, not layout gaps.
 * Dense field: padding 10 + 10 + default text 14 + border 2 = 36.
 */
export const control = {
  minTouch: 44,
  icon: 22,
  textLine: 14,
  denseInputPaddingVertical: 10,
  denseMultilineMinHeight: 72,
} as const;

/** Gear (left) and delete (right) so facing slops equal the gap between them. */
export function titleIconHitSlop(gap: number): { gear: Insets; remove: Insets } {
  const vertical = (control.minTouch - control.icon) / 2;
  const inner = gap / 2;
  const outer = control.minTouch - control.icon - inner;
  return {
    gear: { top: vertical, bottom: vertical, left: outer, right: inner },
    remove: { top: vertical, bottom: vertical, left: inner, right: outer },
  };
}

/** Top slop stays within the gap above the row; bottom fills the 44 dp target. */
export function collapsedRowHitSlop(visualHeight: number, gapAbove: number): Insets {
  const top = gapAbove;
  const bottom = control.minTouch - visualHeight - top;
  return { top, bottom, left: spacing.xs, right: spacing.xs };
}
