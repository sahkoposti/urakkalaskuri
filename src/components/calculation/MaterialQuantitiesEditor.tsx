import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { AppInput, OutlinedButton, SectionTitle } from '@/src/components/common';
import {
  addManualMaterialRow,
  addMaterialShade,
  editMaterialQuantity,
  editMaterialShade,
  formatQuantity,
  parseQuantityInput,
  quantityInputError,
  removeMaterialRow,
  removeMaterialShade,
} from '@/src/core/materials/materialQuantities';
import {
  baseMaterialRows,
  mapMaterialEdit,
  mergedMaterialsForLines,
  moveMaterialRow,
  type MaterialContribution,
  type MaterialLineEntry,
  type MergedMaterialRow,
} from '@/src/core/materials/mergeMaterialRows';
import type { MaterialQuantityRow, MaterialShade, Product, StructureLine } from '@/src/core/models/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { control, spacing } from '@/src/ui/spacing';

type MaterialQuantitiesEditorProps = {
  lines: MaterialLineEntry[];
  products: Product[];
  onChangeLine: (line: StructureLine) => void;
  onValidityChange?: (lineId: string, valid: boolean) => void;
};

export function MaterialQuantitiesEditor({
  lines,
  products,
  onChangeLine,
  onValidityChange,
}: MaterialQuantitiesEditorProps) {
  const styles = useThemedStyles(createStyles);
  const merged = useMemo(() => mergedMaterialsForLines(lines, products), [lines, products]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [openDetail, setOpenDetail] = useState<Record<string, boolean>>({});
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);
  const onValidityChangeRef = useRef(onValidityChange);
  onValidityChangeRef.current = onValidityChange;
  const structureLines = lines.map((entry) => entry.line);

  function textKey(lineId: string, id: string): string {
    return `${lineId}:${id}`;
  }

  function quantityText(lineId: string, row: { id: string; quantity: number }): string {
    const key = textKey(lineId, row.id);
    if (texts[key] !== undefined) return texts[key];
    return row.quantity > 0 ? formatQuantity(row.quantity) : '';
  }

  function shadeText(lineId: string, shade: MaterialShade): string {
    const key = textKey(lineId, shade.id);
    if (texts[key] !== undefined) return texts[key];
    return shade.quantity > 0 ? formatQuantity(shade.quantity) : '';
  }

  function rowsFor(line: StructureLine): MaterialQuantityRow[] {
    const entry = lines.find((item) => item.line.id === line.id);
    return baseMaterialRows(line, entry?.form, products);
  }

  function lineInvalid(entry: MaterialLineEntry): boolean {
    return rowsFor(entry.line).some((row) => {
      if (!row.productName.trim()) return true;
      const shades = row.shades ?? [];
      if (shades.length > 0) {
        return shades.some((shade) => !shade.name.trim() || quantityInputError(shadeText(entry.line.id, shade)) != null);
      }
      return quantityInputError(quantityText(entry.line.id, row)) != null;
    });
  }

  const validityKey = lines
    .map((entry) => `${entry.line.id}:${lineInvalid(entry) ? '0' : '1'}`)
    .join('|');

  useEffect(() => {
    for (const entry of lines) {
      onValidityChangeRef.current?.(entry.line.id, !lineInvalid(entry));
    }
    return () => {
      for (const entry of lines) onValidityChangeRef.current?.(entry.line.id, true);
    };
  }, [validityKey]);

  function commit(nextLines: StructureLine[]) {
    nextLines.forEach((line, index) => {
      if (line !== structureLines[index]) onChangeLine(line);
    });
  }

  function editTargets(
    targets: { lineId: string; rowId: string }[],
    edit: (rows: MaterialQuantityRow[], rowId: string) => MaterialQuantityRow[],
  ) {
    commit(mapMaterialEdit(structureLines, targets, edit, rowsFor));
  }

  function storedRow(contribution: MaterialContribution): MaterialQuantityRow | undefined {
    const entry = lines.find((item) => item.line.id === contribution.lineId);
    if (!entry) return undefined;
    return rowsFor(entry.line).find((row) => row.id === contribution.rowId);
  }

  function addMaterial() {
    const entry = lines[lines.length - 1];
    if (!entry) return;
    const rows = addManualMaterialRow(rowsFor(entry.line));
    onChangeLine({ ...entry.line, materialQuantities: rows });
  }

  function confirmDelete() {
    const group = merged.find((row) => row.key === pendingDeleteKey);
    setPendingDeleteKey(null);
    if (!group) return;
    editTargets(group.contributions, (rows, rowId) => removeMaterialRow(rows, rowId));
  }

  if (lines.length === 0) return null;

  const fieldSpacing = {
    wrap: styles.fieldWrap,
    label: styles.fieldLabel,
    field: styles.fieldDense,
  };
  const addMaterialButton = { button: styles.addMaterialButton };
  const lineChoices = lines.map((entry) => ({ value: entry.line.id, label: entry.line.name }));

  function renderShadeEditor(lineId: string, row: MaterialQuantityRow) {
    const shades = row.shades ?? [];
    return (
      <View style={styles.shades}>
        {shades.map((shade) => {
          const shadeError = !shade.name.trim() ? 'Anna sävy' : quantityInputError(shadeText(lineId, shade));
          return (
            <View key={shade.id} style={styles.shade}>
              <AppInput
                label="Sävy"
                value={shade.name}
                onChangeText={(value) =>
                  editTargets([{ lineId, rowId: row.id }], (rows, rowId) =>
                    editMaterialShade(rows, rowId, shade.id, { name: value }),
                  )
                }
                kind="code"
                spacingOverrides={fieldSpacing}
              />
              <View style={styles.quantityUnitRow}>
                <View style={styles.quantityHalf}>
                  <AppInput
                    label="Määrä"
                    value={shadeText(lineId, shade)}
                    kind="decimal"
                    onChangeText={(value) => {
                      setTexts((current) => ({ ...current, [textKey(lineId, shade.id)]: value }));
                      const parsed = parseQuantityInput(value);
                      if (parsed != null) {
                        editTargets([{ lineId, rowId: row.id }], (rows, rowId) =>
                          editMaterialShade(rows, rowId, shade.id, { quantity: parsed }),
                        );
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
                      editTargets([{ lineId, rowId: row.id }], (rows, rowId) =>
                        editMaterialShade(rows, rowId, shade.id, {
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
                  onPress={() =>
                    editTargets([{ lineId, rowId: row.id }], (rows, rowId) =>
                      removeMaterialShade(rows, rowId, shade.id),
                    )
                  }
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
    );
  }

  function renderQuantityEditor(lineId: string, row: MaterialQuantityRow) {
    const text = quantityText(lineId, row);
    const error = quantityInputError(text);
    return (
      <>
        <View style={styles.quantityUnitRow} testID="material-qty-unit-row">
          <View style={styles.quantityHalf}>
            <AppInput
              label="Määrä"
              value={text}
              kind="decimal"
              onChangeText={(value) => {
                setTexts((current) => ({ ...current, [textKey(lineId, row.id)]: value }));
                const parsed = parseQuantityInput(value);
                if (parsed != null) {
                  editTargets([{ lineId, rowId: row.id }], (rows, rowId) =>
                    editMaterialQuantity(rows, rowId, { quantity: parsed }),
                  );
                }
              }}
              spacingOverrides={fieldSpacing}
            />
          </View>
          <View style={styles.unitHalf}>
            <AppInput
              label="Yksikkö"
              value={row.unit ?? ''}
              onChangeText={(value) =>
                editTargets([{ lineId, rowId: row.id }], (rows, rowId) =>
                  editMaterialQuantity(rows, rowId, { unit: value.trim() ? value : undefined }),
                )
              }
              kind="code"
              spacingOverrides={fieldSpacing}
            />
          </View>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </>
    );
  }

  function renderContribution(group: MergedMaterialRow, contribution: MaterialContribution) {
    const row = storedRow(contribution);
    if (!row) return null;
    const shades = row.shades ?? [];
    return (
      <View key={`${contribution.lineId}:${contribution.rowId}`} style={styles.contribution} testID="material-contribution">
        <Text style={styles.contributionName}>{contribution.lineName}</Text>
        {shades.length > 0 ? (
          <>
            {renderShadeEditor(contribution.lineId, row)}
            <View style={styles.inlineActions}>
              <Pressable
                onPress={() =>
                  editTargets([{ lineId: contribution.lineId, rowId: row.id }], (rows, rowId) =>
                    addMaterialShade(rows, rowId),
                  )
                }
                accessibilityLabel="Lisää sävy"
                style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
              >
                <Text style={styles.removeText}>Lisää sävy</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <AppInput
              label="Määrä"
              value={quantityText(contribution.lineId, row)}
              kind="decimal"
              onChangeText={(value) => {
                setTexts((current) => ({ ...current, [textKey(contribution.lineId, row.id)]: value }));
                const parsed = parseQuantityInput(value);
                if (parsed != null) {
                  editTargets([{ lineId: contribution.lineId, rowId: row.id }], (rows, rowId) =>
                    editMaterialQuantity(rows, rowId, { quantity: parsed }),
                  );
                }
              }}
              spacingOverrides={fieldSpacing}
            />
            <View style={styles.inlineActions}>
              <Pressable
                onPress={() =>
                  editTargets([{ lineId: contribution.lineId, rowId: row.id }], (rows, rowId) =>
                    addMaterialShade(rows, rowId),
                  )
                }
                accessibilityLabel="Lisää sävy"
                style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
              >
                <Text style={styles.removeText}>Lisää sävy</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  function renderMerged(group: MergedMaterialRow) {
    const multiple = group.contributions.length > 1;
    const only = group.contributions.length === 1 ? storedRow(group.contributions[0]) : undefined;
    const showLineChoice =
      !multiple &&
      lines.length > 1 &&
      only?.source === 'manual' &&
      !only.fieldKey &&
      !only.productName.trim();
    const showShades = multiple ? group.shades.length > 0 : (only?.shades?.length ?? 0) > 0;

    return (
      <View key={group.key} style={styles.row}>
        {showLineChoice && only ? (
          <AppPicker
            label="Rakenne"
            selectedValue={group.contributions[0].lineId}
            items={lineChoices}
            onValueChange={(lineId) => {
              if (lineId === group.contributions[0].lineId) return;
              commit(
                moveMaterialRow(structureLines, group.contributions[0].lineId, only.id, lineId, rowsFor),
              );
            }}
          />
        ) : null}
        <AppInput
          label="Tuote"
          value={multiple ? group.productName : (only?.productName ?? group.productName)}
          onChangeText={(value) =>
            editTargets(group.contributions, (rows, rowId) => editMaterialQuantity(rows, rowId, { productName: value }))
          }
          kind="code"
          spacingOverrides={fieldSpacing}
        />
        {multiple && showShades ? (
          <View style={styles.shadeSummary}>
            {group.shades.map((shade) => (
              <Text key={shade.key} style={styles.summaryText}>
                {shade.name.trim() || 'Sävy'} {formatQuantity(shade.quantity)}
                {shade.unit ? ` ${shade.unit}` : ''}
              </Text>
            ))}
          </View>
        ) : null}
        {multiple && !showShades ? (
          <View style={styles.quantityUnitRow} testID="material-qty-unit-row">
            <View style={styles.quantityHalf}>
              <Text style={styles.fieldLabel}>Määrä</Text>
              <Text style={styles.readOnlyValue} testID="material-readonly-qty">
                {formatQuantity(group.quantity)}
              </Text>
            </View>
            <View style={styles.unitHalf}>
              <AppInput
                label="Yksikkö"
                value={group.unit ?? ''}
                onChangeText={(value) =>
                  editTargets(group.contributions, (rows, rowId) =>
                    editMaterialQuantity(rows, rowId, { unit: value.trim() ? value : undefined }),
                  )
                }
                kind="code"
                spacingOverrides={fieldSpacing}
              />
            </View>
          </View>
        ) : null}
        {multiple && showShades ? (
          <AppInput
            label="Yksikkö"
            value={group.unit ?? ''}
            onChangeText={(value) =>
              editTargets(group.contributions, (rows, rowId) =>
                editMaterialQuantity(rows, rowId, { unit: value.trim() ? value : undefined }),
              )
            }
            kind="code"
            spacingOverrides={fieldSpacing}
          />
        ) : null}
        {!multiple && only ? (
          showShades ? renderShadeEditor(group.contributions[0].lineId, only) : renderQuantityEditor(group.contributions[0].lineId, only)
        ) : null}
        <View style={styles.inlineActions} testID="material-inline-actions">
          {multiple ? (
            <Pressable
              onPress={() => setOpenDetail((current) => ({ ...current, [group.key]: !current[group.key] }))}
              accessibilityLabel="Erittely"
              accessibilityState={{ expanded: Boolean(openDetail[group.key]) }}
              style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
            >
              <Text style={styles.removeText}>Erittely</Text>
            </Pressable>
          ) : only ? (
            <Pressable
              onPress={() =>
                editTargets([{ lineId: group.contributions[0].lineId, rowId: only.id }], (rows, rowId) =>
                  addMaterialShade(rows, rowId),
                )
              }
              accessibilityLabel="Lisää sävy"
              style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
            >
              <Text style={styles.removeText}>Lisää sävy</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              if (multiple) setPendingDeleteKey(group.key);
              else if (only) {
                editTargets([{ lineId: group.contributions[0].lineId, rowId: only.id }], (rows, rowId) =>
                  removeMaterialRow(rows, rowId),
                );
              }
            }}
            accessibilityLabel="Poista materiaali"
            style={({ pressed }) => [styles.inlineAction, pressed && styles.removePressed]}
          >
            <Text style={styles.removeText}>Poista</Text>
          </Pressable>
        </View>
        {multiple && openDetail[group.key]
          ? group.contributions.map((contribution) => renderContribution(group, contribution))
          : null}
      </View>
    );
  }

  return (
    <View style={styles.section} testID="structure-materials">
      <SectionTitle
        title="Materiaalit (urakkakortti)"
        containerStyle={styles.sectionTitle}
        underlineStyle={styles.sectionUnderline}
      />
      <Text style={styles.hint}>Yhdellä tuotteella voi olla useita sävyjä. Jokaisella sävyllä on oma määrä.</Text>
      {merged.map((group) => renderMerged(group))}
      <OutlinedButton title="Lisää materiaali" onPress={addMaterial} styleOverrides={addMaterialButton} />
      <ConfirmDialog
        visible={pendingDeleteKey != null}
        title="Poista materiaali?"
        message="Materiaali poistetaan kaikista rakenteista, joihin se kuuluu."
        onClose={() => setPendingDeleteKey(null)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setPendingDeleteKey(null) },
          { title: 'Poista', variant: 'destructive', onPress: confirmDelete },
        ]}
      />
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      marginBottom: 0,
    },
    sectionUnderline: {
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
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
      color: colors.text,
    },
    fieldDense: {
      paddingVertical: control.denseInputPaddingVertical,
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
    readOnlyValue: {
      minHeight: control.denseInputPaddingVertical * 2 + control.textLine + 2,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: control.textLine,
      color: colors.primary,
      textAlignVertical: 'center' as const,
    },
    shadeSummary: {
      gap: spacing.xs,
    },
    summaryText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: control.textLine,
      color: colors.text,
    },
    shades: {
      gap: spacing.sm,
      marginLeft: spacing.md,
    },
    shade: {
      gap: spacing.sm,
    },
    contribution: {
      gap: spacing.sm,
      marginLeft: spacing.md,
    },
    contributionName: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: control.textLine,
      color: colors.primary,
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
