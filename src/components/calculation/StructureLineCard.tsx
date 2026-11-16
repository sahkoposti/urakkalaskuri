import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AppCard, AppInput } from '@/src/components/common';
import { NAME_FIELD_KIND } from '@/src/components/textInputProps';
import { ChoiceToggle } from '@/src/components/ChoiceToggle';
import { ThemedIcon } from '@/src/components/ThemedIcon';
import {
  STRUCTURE_LINE_ADDITIONAL_INFO_DEFAULT_EXPANDED,
  structureLineAdditionalInfoHasText,
} from '@/src/core/structure/structureLineAdditionalInfoUi';
import { structureLineAdditionalInfoInputValue } from '@/src/core/pdf/structureExtraText';
import { patchStructureLine } from '@/src/core/structure/applyFormToLine';
import { hasStructureFormPages, isStructureFormIncomplete } from '@/src/core/structure/formPages';
import {
  fromCardAmount,
  linePricesIncludeVat,
  lineTotalVat0,
  toCardAmount,
  withDerivedLinePricing,
} from '@/src/core/structure/linePricing';
import { defaultSettings, type StructureLine } from '@/src/core/models/types';
import { isManualStructureId, type ProductStructure } from '@/src/core/structure/types';
import { vat0Tag, vatInclTag } from '@/src/core/utils/priceDisplay';
import {
  normalizeDisplayWorkDurationDays,
  resolveDisplayedWorkDurationDays,
  WORK_DURATION_DISPLAY_LABEL,
} from '@/src/core/structure/workDurationDisplay';
import {
  formatCurrency,
  formatFixed2,
  formatPercent,
  limitDecimalInput,
  parseNumber,
  roundToCents,
} from '@/src/core/utils/formatters';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { collapsedRowHitSlop, control, spacing, titleIconHitSlop } from '@/src/ui/spacing';

type StructureLineCardProps = {
  line: StructureLine;
  structure?: ProductStructure;
  weatherReserveFactor?: number;
  /** Asetusten työpäivän pituus (h). Kesto päiviin: tunnit / tämä. */
  workdayHours?: number;
  /** Käänteinen ALV: hinnat aina ALV 0, valintaa ei näytetä. */
  forceVat0?: boolean;
  /**
   * Yritystarjouksen yhteinen ALV. Kun annettu, rivin omaa valintaa ei näytetä
   * eikä `pricesIncludeVat` ohjaa syöttöä. Puuttuva = yksityinen rivikohtainen valinta.
   */
  offerIncludesVat?: boolean;
  onChange: (line: StructureLine) => void;
  onOpenForm?: () => void;
  onDelete: () => void;
  /** Myöhemmän rivin oma teksti piilotetaan, kun aiemmalla rivillä on jo lisätiedot. */
  showAdditionalInfo?: boolean;
  /** Tyhjä määräkenttä: false estää yhteenvedon (kuten materiaalimäärät). */
  onValidityChange?: (lineId: string, valid: boolean) => void;
};

export function StructureLineCard({
  line,
  structure,
  weatherReserveFactor = 1,
  workdayHours = defaultSettings.workdayHours,
  forceVat0 = false,
  offerIncludesVat,
  onChange,
  onOpenForm,
  onDelete,
  showAdditionalInfo = true,
  onValidityChange,
}: StructureLineCardProps) {
  const onValidityChangeRef = useRef(onValidityChange);
  onValidityChangeRef.current = onValidityChange;
  const styles = useThemedStyles(createStyles);
  const priced = withDerivedLinePricing(line);
  const manual = isManualStructureId(priced.structureId);
  const showGear = !manual && structure ? hasStructureFormPages(structure.form) : false;
  const formIncomplete = isStructureFormIncomplete(priced, structure);
  const includeVat = forceVat0
    ? false
    : offerIncludesVat !== undefined
      ? offerIncludesVat
      : linePricesIncludeVat(priced);
  const vatPercent = priced.vatPercent;
  const displayedWorkDurationDays = resolveDisplayedWorkDurationDays(
    priced,
    weatherReserveFactor,
    workdayHours,
  );
  const additionalInfoValue = structureLineAdditionalInfoInputValue(priced, structure);
  const [additionalInfoExpanded, setAdditionalInfoExpanded] = useState(
    STRUCTURE_LINE_ADDITIONAL_INFO_DEFAULT_EXPANDED,
  );

  function patch(next: Parameters<typeof patchStructureLine>[1]) {
    onChange(patchStructureLine(priced, next));
  }

  const iconSlop = titleIconHitSlop(spacing.lg);
  const inputDense = {
    wrap: styles.inputWrapDense,
    label: styles.inputLabelDense,
    field: styles.inputFieldDense,
  };
  const inputDenseMultiline = {
    wrap: styles.inputWrapDense,
    label: styles.inputLabelDense,
    field: styles.inputMultilineDense,
  };
  const toggleDense = {
    row: styles.toggleRowDense,
    label: styles.toggleLabelDense,
    button: styles.toggleButtonDense,
  };

  return (
    <AppCard style={styles.card}>
      <View style={styles.titleRow}>
        {showGear && onOpenForm ? (
          <Pressable onPress={onOpenForm} hitSlop={iconSlop.gear} accessibilityLabel="Avaa lomake">
            <ThemedIcon name="settings" size={control.icon} />
          </Pressable>
        ) : null}
        <Pressable onPress={onDelete} hitSlop={iconSlop.remove} accessibilityLabel="Poista rivi">
          <ThemedIcon name="trash" size={control.icon} />
        </Pressable>
      </View>
      <AppInput
        label="Nimi"
        value={priced.name}
        onChangeText={(value) => patch({ name: value })}
        kind={NAME_FIELD_KIND.lineName}
        placeholder="Tuoterakenne"
        spacingOverrides={inputDense}
      />
      {formIncomplete ? <Text style={styles.incomplete}>Keskeneräinen lomake</Text> : null}

      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <QuantityDecimalInput
            label="Määrä"
            value={priced.quantity}
            onChangeValue={(value) => patch({ quantity: value })}
            onValidityChange={(valid) => onValidityChangeRef.current?.(priced.id, valid)}
            spacingOverrides={inputDense}
            errorStyle={styles.error}
          />
        </View>
        <View style={styles.fieldHalf}>
          <AppInput
            label="Yksikkö"
            value={priced.unit ?? ''}
            onChangeText={(value) => patch({ unit: value })}
            kind="code"
            spacingOverrides={inputDense}
          />
        </View>
      </View>

      {forceVat0 || offerIncludesVat !== undefined ? null : (
        <ChoiceToggle
          label="Hinnat"
          value={includeVat}
          options={[
            { value: false, label: vat0Tag() },
            { value: true, label: vatInclTag(vatPercent) },
          ]}
          onChange={(next) => patch({ pricesIncludeVat: next })}
          spacingOverrides={toggleDense}
        />
      )}

      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <DecimalInput
            label="Hinta €"
            value={toCardAmount(priced.unitPriceVat0, includeVat, vatPercent)}
            onChangeValue={(value) =>
              patch({ unitPriceVat0: fromCardAmount(value, includeVat, vatPercent) })
            }
            emptyAsZero
            spacingOverrides={inputDense}
          />
        </View>
        <View style={styles.fieldHalf}>
          <DecimalInput
            label="Materiaalit €"
            value={toCardAmount(priced.materialsVat0, includeVat, vatPercent)}
            onChangeValue={(value) =>
              patch({ materialsVat0: fromCardAmount(value, includeVat, vatPercent) })
            }
            emptyAsZero
            spacingOverrides={inputDense}
          />
        </View>
      </View>

      <View style={styles.fieldRow}>
        <View style={styles.fieldHalf}>
          <DecimalInput
            label="Urakkahinta € (alv0)"
            value={priced.contractPriceVat0}
            onChangeValue={(value) => patch({ contractPriceVat0: value })}
            emptyAsZero
            spacingOverrides={inputDense}
          />
        </View>
        <View style={styles.fieldHalf}>
          <DaysInput
            label={WORK_DURATION_DISPLAY_LABEL}
            value={displayedWorkDurationDays}
            onChangeValue={(value) => patch({ displayWorkDurationDays: value })}
            spacingOverrides={inputDense}
          />
        </View>
      </View>

      {showAdditionalInfo ? (
        additionalInfoExpanded ? (
          <AppInput
            label="Lisätiedot"
            value={additionalInfoValue}
            onChangeText={(value) => patch({ additionalInfo: value })}
            kind="sentence"
            multiline
            placeholder="Valinnainen"
            spacingOverrides={inputDenseMultiline}
          />
        ) : (
          <Pressable
            onPress={() => setAdditionalInfoExpanded(true)}
            hitSlop={styles.additionalInfoHitSlop}
            style={({ pressed }) => [styles.additionalInfoRow, pressed && styles.additionalInfoRowPressed]}
            accessibilityRole="button"
            accessibilityLabel="Avaa Lisätiedot"
          >
            <Text style={styles.additionalInfoLabel}>Lisätiedot</Text>
            <Text style={styles.additionalInfoHint} numberOfLines={1}>
              {structureLineAdditionalInfoHasText(additionalInfoValue) ? additionalInfoValue.trim() : 'Valinnainen'}
            </Text>
            <ThemedIcon name="chevron-forward" size={18} />
          </Pressable>
        )
      ) : null}

      <DecimalInput
        label="Ale %"
        value={priced.discountPercent}
        onChangeValue={(value) => patch({ discountPercent: value })}
        spacingOverrides={inputDense}
      />

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Kate ({vat0Tag()})</Text>
        <Text style={styles.metaValue}>
          {formatCurrency(priced.marginEur)} · {formatPercent(priced.marginPercent)}
        </Text>
      </View>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Yhteensä</Text>
        <Text style={styles.totalValue}>
          {formatCurrency(toCardAmount(lineTotalVat0(priced), includeVat, vatPercent))}
        </Text>
      </View>
    </AppCard>
  );
}

function DaysInput({
  label,
  value,
  onChangeValue,
  spacingOverrides,
}: {
  label: string;
  value: number | undefined;
  onChangeValue: (value: number | null) => void;
  spacingOverrides?: {
    wrap?: object;
    label?: object;
    field?: object;
  };
}) {
  const display = value != null && value > 0 ? String(value) : '';
  const [text, setText] = useState(display);
  const lastSent = useRef(value != null && value > 0 ? value : 0);

  useEffect(() => {
    const next = value != null && value > 0 ? value : 0;
    if (next !== lastSent.current) {
      lastSent.current = next;
      setText(next > 0 ? String(next) : '');
    }
  }, [value]);

  return (
    <AppInput
      label={label}
      value={text}
      kind="decimal"
      placeholder="Valinnainen"
      spacingOverrides={spacingOverrides}
      onChangeText={(raw) => {
        const next = limitDecimalInput(raw, 0);
        setText(next);
        if (!next.trim()) {
          lastSent.current = 0;
          onChangeValue(null);
          return;
        }
        const parsed = parseNumber(next);
        if (parsed === null) return;
        const days = normalizeDisplayWorkDurationDays(parsed);
        if (days == null) {
          lastSent.current = 0;
          onChangeValue(null);
          return;
        }
        lastSent.current = days;
        onChangeValue(days);
      }}
    />
  );
}

function structureQuantityInputError(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return 'Anna määrä';
  const parsed = parseNumber(text);
  if (parsed === null || parsed < 0) return 'Tarkista määrä';
  return null;
}

function QuantityDecimalInput({
  label,
  value,
  onChangeValue,
  onValidityChange,
  spacingOverrides,
  errorStyle,
}: {
  label: string;
  value: number;
  onChangeValue: (value: number) => void;
  onValidityChange?: (valid: boolean) => void;
  spacingOverrides?: {
    wrap?: object;
    label?: object;
    field?: object;
  };
  errorStyle: { fontFamily: string; fontSize: number; color: string };
}) {
  const [text, setText] = useState(formatFixed2(value));
  const lastSent = useRef(roundToCents(value));
  const error = structureQuantityInputError(text);

  useEffect(() => {
    const next = roundToCents(value);
    if (next !== lastSent.current) {
      lastSent.current = next;
      setText(formatFixed2(next));
    }
  }, [value]);

  useEffect(() => {
    onValidityChange?.(error === null);
  }, [error, onValidityChange]);

  return (
    <View>
      <AppInput
        label={label}
        value={text}
        kind="decimal"
        spacingOverrides={spacingOverrides}
        onChangeText={(raw) => {
          const next = limitDecimalInput(raw, 2, false);
          setText(next);
          const inputError = structureQuantityInputError(next);
          if (inputError !== null) return;
          const parsed = parseNumber(next);
          if (parsed === null) return;
          const rounded = roundToCents(parsed);
          lastSent.current = rounded;
          onChangeValue(rounded);
        }}
      />
      {error ? <Text style={errorStyle}>{error}</Text> : null}
    </View>
  );
}

function DecimalInput({
  label,
  value,
  onChangeValue,
  emptyAsZero = false,
  spacingOverrides,
}: {
  label: string;
  value: number;
  onChangeValue: (value: number) => void;
  emptyAsZero?: boolean;
  spacingOverrides?: {
    wrap?: object;
    label?: object;
    field?: object;
  };
}) {
  const [text, setText] = useState(formatFixed2(value));
  const lastSent = useRef(roundToCents(value));
  const [showEmptyWhileZero, setShowEmptyWhileZero] = useState(false);

  useEffect(() => {
    if (showEmptyWhileZero && roundToCents(value) === 0) return;
    const next = roundToCents(value);
    if (next !== lastSent.current) {
      lastSent.current = next;
      setText(formatFixed2(next));
      setShowEmptyWhileZero(false);
    }
  }, [value, showEmptyWhileZero]);

  return (
    <AppInput
      label={label}
      value={text}
      kind="decimal"
      spacingOverrides={spacingOverrides}
      onChangeText={(raw) => {
        const next = limitDecimalInput(raw);
        setText(next);
        if (!next.trim()) {
          if (emptyAsZero) {
            setShowEmptyWhileZero(true);
            lastSent.current = 0;
            onChangeValue(0);
          }
          return;
        }
        setShowEmptyWhileZero(false);
        const parsed = parseNumber(next);
        if (parsed === null) return;
        const rounded = roundToCents(parsed);
        lastSent.current = rounded;
        onChangeValue(rounded);
      }}
    />
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    card: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    additionalInfoHitSlop: collapsedRowHitSlop(
      spacing.xs * 2 + control.textLine,
      spacing.sm,
    ),
    additionalInfoRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.sm,
      marginBottom: spacing.sm,
      paddingVertical: spacing.xs,
    },
    additionalInfoRowPressed: {
      opacity: 0.85,
    },
    additionalInfoLabel: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
      color: colors.text,
    },
    additionalInfoHint: {
      flex: 1,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 14,
      color: colors.text,
      opacity: 0.65,
    },
    titleRow: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      justifyContent: 'flex-end' as const,
      gap: spacing.lg,
      marginBottom: spacing.sm,
    },
    incomplete: {
      marginTop: spacing.xs,
      marginBottom: spacing.xs,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.accent,
    },
    error: {
      marginTop: -spacing.xs,
      marginBottom: spacing.xs,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.accent,
    },
    fieldRow: {
      flexDirection: 'row' as const,
      gap: spacing.sm,
    },
    fieldHalf: {
      flex: 1,
    },
    metaRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
    },
    metaLabel: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
    },
    metaValue: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
    },
    totalRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    totalLabel: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    totalValue: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.accent,
      fontSize: 16,
    },
    inputWrapDense: {
      marginBottom: spacing.sm,
    },
    inputLabelDense: {
      marginBottom: spacing.xs,
    },
    inputFieldDense: {
      paddingVertical: control.denseInputPaddingVertical,
    },
    inputMultilineDense: {
      minHeight: control.denseMultilineMinHeight,
      paddingVertical: control.denseInputPaddingVertical,
      textAlignVertical: 'top' as const,
    },
    toggleRowDense: {
      marginBottom: spacing.sm,
    },
    toggleLabelDense: {
      marginBottom: spacing.xs,
    },
    toggleButtonDense: {
      minHeight: control.minTouch,
      paddingVertical: spacing.sm,
      justifyContent: 'center' as const,
    },
  };
}
