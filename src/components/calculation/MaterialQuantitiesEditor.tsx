import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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

  return (
    <View style={styles.wrap}>
      {showSection ? (
        <View style={styles.section}>
          <Text style={styles.title}>Materiaalit (urakkakortti)</Text>
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
                />
                {shades.length === 0 ? (
                  <>
                    <AppInput
                      label="Määrä"
                      value={text}
                      kind="decimal"
                      onChangeText={(value) => {
                        setTexts((current) => ({ ...current, [row.id]: value }));
                        const parsed = parseQuantityInput(value);
                        if (parsed != null) commit(editMaterialQuantity(baseRows(), row.id, { quantity: parsed }));
                      }}
                    />
                    {error ? <Text style={styles.error}>{error}</Text> : null}
                    <AppInput
                      label="Yksikkö"
                      value={row.unit ?? ''}
                      onChangeText={(value) =>
                        commit(editMaterialQuantity(baseRows(), row.id, { unit: value.trim() ? value : undefined }))
                      }
                      kind="code"
                    />
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
                          />
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
                          />
                          {shadeError ? <Text style={styles.error}>{shadeError}</Text> : null}
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
                          />
                          <Pressable
                            onPress={() => commit(removeMaterialShade(baseRows(), row.id, shade.id))}
                            accessibilityLabel="Poista sävy"
                            style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
                          >
                            <Text style={styles.removeText}>Poista sävy</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
                <Pressable
                  onPress={() => commit(addMaterialShade(baseRows(), row.id))}
                  accessibilityLabel="Lisää sävy"
                  style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
                >
                  <Text style={styles.removeText}>Lisää sävy</Text>
                </Pressable>
                <Pressable
                  onPress={() => commit(removeMaterialRow(baseRows(), row.id))}
                  accessibilityLabel="Poista materiaali"
                  style={({ pressed }) => [styles.remove, pressed && styles.removePressed]}
                >
                  <Text style={styles.removeText}>Poista</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
      <OutlinedButton title="Lisää materiaali" onPress={() => commit(addManualMaterialRow(baseRows()))} />
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      gap: 8,
    },
    section: {
      gap: 8,
    },
    title: {
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
      gap: 4,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    shades: {
      gap: 8,
      marginLeft: 12,
    },
    shade: {
      gap: 4,
    },
    error: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.accent,
    },
    remove: {
      alignSelf: 'flex-start' as const,
      minHeight: 44,
      justifyContent: 'center' as const,
      paddingVertical: 4,
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
