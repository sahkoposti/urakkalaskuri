export type AppPickerItem = {
  label: string;
  value: string;
};

export function pickerDisplayLabel(
  items: AppPickerItem[],
  selectedValue: string,
  placeholder = 'Valitse...',
): string {
  const match = items.find((item) => item.value === selectedValue);
  return match?.label ?? placeholder;
}
