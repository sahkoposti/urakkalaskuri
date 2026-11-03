import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppInput, OutlinedButton } from '@/src/components/common';
import type { FormDefinition } from '@/src/core/form/types';
import {
  addManualMaterialRow,
  editMaterialQuantity,
  formatQuantity,
  parseQuantityInput,
  prefillMaterialQuantities,
  quantityInputError,
  removeMaterialRow,
} from '@/src/core/materials/materialQuantities';
import type { MaterialQuantityRow, Product, StructureLine } from '@/src/core/models/types';
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

  const invalid = displayed.some((row) => {
    return !row.productName.trim() || quantityInputError(quantityText(row)) != null;
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
          {displayed.map((row) => {
            const text = quantityText(row);
            const error = quantityInputError(text);
            return (
              <View key={row.id} style={styles.row}>
                <AppInput
                  label="Tuote"
                  value={row.productName}
                  onChangeText={(value) => commit(editMaterialQuantity(baseRows(), row.id, { productName: value }))}
                />
                <AppInput
                  label="Määrä"
                  value={text}
                  keyboardType="decimal-pad"
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
                />
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
    row: {
      gap: 4,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    error: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.accent,
    },
    remove: {
      alignSelf: 'flex-start' as const,
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
