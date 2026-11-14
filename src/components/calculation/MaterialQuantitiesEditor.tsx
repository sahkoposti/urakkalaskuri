import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput, OutlinedButton } from '@/src/components/common';
import type { FormDefinition } from '@/src/core/form/types';
import {
  addManualMaterialRow,
  addMaterialShade,
  editMaterialQuantity,
  editMaterialShade,
  formatQuantity,
  parseQuantityInput,
  prefillMaterialQuantities,
  quantityInputError,
  removeMaterialRow,
  removeMaterialShade,
} from '@/src/core/materials/materialQuantities';
import type { MaterialQuantityRow, MaterialShade, Product, StructureLine } from '@/src/core/models/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { control, spacing } from '@/src/ui/spacing';

type MaterialQuantitiesEditorProps = {
  line: StructureLine;
  form?: FormDefinition;
  products: Product[];
  onChange: (line: StructureLine) => void;
  onValidityChange?: (lineId: string, valid: boolean) => void;
};

export function MaterialQuantitiesEditor({
  line,
  form,
  products,
  onChange,
  onValidityChange,
}: MaterialQuantitiesEditorProps) {
  const styles = useThemedStyles(createStyles);
  const prefill = useMemo(
    () => prefillMaterialQuantities(line, form, products),
    [line, form, products],
  );
  const displayed = line.materialQuantities ?? prefill;
  const showSection = displayed.length > 0 || prefill.length > 0;
  const [texts, setTexts] = useState<Record<string, string>>({});
  const onValidityChangeRef = useRef(onValidityChange);
  onValidityChangeRef.current = onValidityChange;

  function quantityText(row: MaterialQuantityRow): string {
    if (texts[row.id] !== undefined) return texts[row.id];
    return row.quantity > 0 ? formatQuantity(row.quantity) : '';
  }

  function shadeText(shade: MaterialShade): string {
    if (texts[shade.id] !== undefined) return texts[shade.id];
    return shade.quantity > 0 ? formatQuantity(shade.quantity) : '';
  }

  const invalid = displayed.some((row) => {
    if (!row.productName.trim()) return true;
    const shades = row.shades ?? [];
    if (shades.length > 0) {
      return shades.some((shade) => !shade.name.trim() || quantityInputError(shadeText(shade)) != null);
    }
    return quantityInputError(quantityText(row)) != null;
  });

  useEffect(() => {
    onValidityChangeRef.current?.(line.id, !invalid);
    return () => onValidityChangeRef.current?.(line.id, true);
  }, [line.id, invalid]);

  function baseRows(): MaterialQuantityRow[] {
    return line.materialQuantities ?? prefillMaterialQuantities(line, form, products);
  }

  function commit(rows: MaterialQuantityRow[]) {
    onChange({ ...line, materialQuantities: rows });
  }

  const fieldSpacing = {
    wrap: styles.fieldWrap,
    label: styles.fieldLabel,
    field: styles.fieldDense,
  };
  const addMaterialButton = {
    button: styles.addMaterialButton,
  };

  return (
    <View style={styles.wrap} testID="structure-materials">
      {showSection ? (
        <View>
          <Text style={styles.title}>Materiaalit (urakkakortti)</Text>
          <View style={styles.section}>
          <Text style={styles.hint}>Yhdellä tuotteella voi olla useita sävyjä. Jokaisella sävyllä on oma määrä.</Text>
          {displayed.map((row) => {
            const shades = row.shades ?? [];
            const text = quantityText(row);
            const error = shades.length === 0 ? quantityInputError(text) : null;
            return (
              <View key={row.id} style={styles.row}>
                <AppInput
                  label="Tuote"
                  value={row.productName}
                  onChangeText={(value) => commit(editMaterialQuantity(baseRows(), row.id, { productName: value }))}
                  kind="code"
                  spacingOverrides={fieldSpacing}
                />
                {shades.length === 0 ? (
                  <>
                    <View style={styles.quantityUnitRow} testID="material-qty-unit-row">
                      <View style={styles.quantityHalf}>
                        <AppInput
                          label="Määrä"
                          value={text}
                          kind="decimal"
                          onChangeText={(value) => {
                            setTexts((current) => ({ ...current, [row.id]: value }));
                            const parsed = parseQuantityInput(value);
                            if (parsed != null) commit(editMaterialQuantity(baseRows(), row.id, { quantity: parsed }));
                          }}
                          spacingOverrides={fieldSpacing}
                        />
                      </View>
                      <View style={styles.unitHalf}>
                        <AppInput
                          label="Yksikkö"
                          value={row.unit ?? ''}
                          onChangeText={(value) =>
                            commit(
                              editMaterialQuantity(baseRows(), row.id, { unit: value.trim() ? value : undefined }),
                            )
                          }
                          kind="code"
                          spacingOverrides={fieldSpacing}
                        />
                      </View>
                    </View>
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                  </>
                ) : (
                  <View style={styles.shades}>
                    {shades.map((shade) => {
                      const shadeError = !shade.name.trim()
                        ? 'Anna sävy'
                        : quantityInputError(shadeText(shade));
                      return (
                        <View key={shade.id} style={styles.shade}>
                          <AppInput
                            label="Sävy"
                            value={shade.name}
                            onChangeText={(value) =>
                              commit(editMaterialShade(baseRows(), row.id, shade.id, { name: value }))
                            }
                            kind="code"
                            spacingOverrides={fieldSpacing}
                          />
                          <View style={styles.quantityUnitRow}>
                            <View style={styles.quantityHalf}>
                              <AppInput
                                label="Määrä"
                                value={shadeText(shade)}
                                kind="decimal"
                                onChangeText={(value) => {
                                  setTexts((current) => ({ ...current, [shade.id]: value }));
                                  const parsed = parseQuantityInput(value);
                                  if (parsed != null) {
                                    commit(editMaterialShade(baseRows(), row.id, shade.id, { quantity: parsed }));
                                  }
                                }}
                                spacingOverrides={fieldSpacing}
                              />
                            </View>
                            <View style={styles.unitHalf}>
                              <AppInput
                                label="Yksikkö"
                                value={shade.unit ?? ''}
                                onChangeText={(value) =>
                                  commit(
                                    editMaterialShade(baseRows(), row.id, shade.id, {
                                      unit: value.trim() ? value : undefined,
                                    }),
                                  )
                                }
                                kind="code"
                                spacingOverrides={fieldSpacing}
                              />
                            </View>
                          </View>
                          {shadeError ? <Text style={styles.error}>{shadeError}</Text> : null}
                          <View style={styles.inlineActions}>
                            <Pressable
                              onPress={() => commit(removeMaterialShade(baseRows(), row.id, shade.id))}
                              accessibilityLabel="Poista sävy"
                              style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
                            >
                              <Text style={styles.removeText}>Poista sävy</Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                <View style={styles.inlineActions} testID="material-inline-actions">
                  <Pressable
                    onPress={() => commit(addMaterialShade(baseRows(), row.id))}
                    accessibilityLabel="Lisää sävy"
                    style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
                  >
                    <Text style={styles.removeText}>Lisää sävy</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => commit(removeMaterialRow(baseRows(), row.id))}
                    accessibilityLabel="Poista materiaali"
                    style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
                  >
                    <Text style={styles.removeText}>Poista</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
          </View>
        </View>
      ) : null}
      <View style={showSection ? styles.addAfterRows : undefined}>
        <OutlinedButton
          title="Lisää materiaali"
          onPress={() => commit(addManualMaterialRow(baseRows()))}
          styleOverrides={addMaterialButton}
        />
      </View>
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    section: {
      gap: spacing.sm,
    },
    addAfterRows: {
      marginTop: spacing.xs,
    },
    addMaterialButton: {
      minHeight: control.minTouch,
      paddingVertical: spacing.sm,
      justifyContent: 'center' as const,
    },
    fieldWrap: {
      marginBottom: 0,
    },
    fieldLabel: {
      marginBottom: spacing.xs,
    },
    fieldDense: {
      paddingVertical: control.denseInputPaddingVertical,
    },
    title: {
      marginBottom: spacing.xs,
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 15,
      color: colors.primary,
    },
    hint: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.text,
    },
    row: {
      gap: spacing.sm,
      paddingBottom: spacing.xs,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    quantityUnitRow: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
      alignItems: 'flex-start' as const,
    },
    quantityHalf: {
      flex: 1.35,
    },
    unitHalf: {
      flex: 0.65,
    },
    shades: {
      gap: spacing.sm,
      marginLeft: spacing.md,
    },
    shade: {
      gap: spacing.sm,
    },
    error: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.accent,
    },
    inlineActions: {
      flexDirection: 'row' as const,
      justifyContent: 'flex-end' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
    },
    inlineAction: {
      minHeight: control.minTouch,
      minWidth: control.minTouch,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.sm,
    },
    removePressed: {
      opacity: 0.7,
    },
    removeText: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
      color: colors.accent,
    },
  };
}
