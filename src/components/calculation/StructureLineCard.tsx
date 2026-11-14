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
import type { StructureLine } from '@/src/core/models/types';
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

type StructureLineCardProps = {
  line: StructureLine;
  structure?: ProductStructure;
  weatherReserveFactor?: number;
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
};

export function StructureLineCard({
  line,
  structure,
  weatherReserveFactor = 1,
  forceVat0 = false,
  offerIncludesVat,
  onChange,
  onOpenForm,
  onDelete,
  showAdditionalInfo = true,
}: StructureLineCardProps) {
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
  );
  const additionalInfoValue = structureLineAdditionalInfoInputValue(priced, structure);
  const [additionalInfoExpanded, setAdditionalInfoExpanded] = useState(
    STRUCTURE_LINE_ADDITIONAL_INFO_DEFAULT_EXPANDED,
  );

  function patch(next: Parameters<typeof patchStructureLine>[1]) {
    onChange(patchStructureLine(priced, next));
  }

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
    buttonHitSlop: styles.toggleButtonHitSlop,
  };

  return (
    <AppCard style={styles.card}>
      <View style={styles.titleRow}>
        {showGear && onOpenForm ? (
          <Pressable onPress={onOpenForm} hitSlop={11} accessibilityLabel="Avaa lomake">
            <ThemedIcon name="settings" size={22} />
          </Pressable>
        ) : null}
        <Pressable onPress={onDelete} hitSlop={11} accessibilityLabel="Poista rivi">
          <ThemedIcon name="trash" size={22} />
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
          <DecimalInput
            label="Määrä"
            value={priced.quantity}
            onChangeValue={(value) => patch({ quantity: value })}
            spacingOverrides={inputDense}
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

function DecimalInput({
  label,
  value,
  onChangeValue,
  spacingOverrides,
}: {
  label: string;
  value: number;
  onChangeValue: (value: number) => void;
  spacingOverrides?: {
    wrap?: object;
    label?: object;
    field?: object;
  };
}) {
  const [text, setText] = useState(formatFixed2(value));
  const lastSent = useRef(roundToCents(value));

  useEffect(() => {
    const next = roundToCents(value);
    if (next !== lastSent.current) {
      lastSent.current = next;
      setText(formatFixed2(next));
    }
  }, [value]);

  return (
    <AppInput
      label={label}
      value={text}
      kind="decimal"
      spacingOverrides={spacingOverrides}
      onChangeText={(raw) => {
        const next = limitDecimalInput(raw);
        setText(next);
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
      gap: 0,
      paddingVertical: 6,
      paddingHorizontal: 16,
    },
    additionalInfoHitSlop: {
      top: 11,
      bottom: 11,
      left: 4,
      right: 4,
    },
    additionalInfoRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      marginTop: 0,
      marginBottom: 0,
      paddingVertical: 2,
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
      gap: 8,
      marginBottom: 2,
    },
    incomplete: {
      marginTop: 1,
      marginBottom: 3,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.accent,
    },
    fieldRow: {
      flexDirection: 'row' as const,
      gap: 8,
    },
    fieldHalf: {
      flex: 1,
    },
    metaRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      marginTop: 1,
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
      marginTop: 2,
      paddingTop: 3,
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
      marginBottom: 3,
    },
    inputLabelDense: {
      marginBottom: 2,
    },
    inputFieldDense: {
      paddingVertical: 5,
    },
    inputMultilineDense: {
      minHeight: 72,
      paddingVertical: 5,
      textAlignVertical: 'top' as const,
    },
    toggleRowDense: {
      marginBottom: 3,
    },
    toggleLabelDense: {
      marginBottom: 2,
    },
    toggleButtonDense: {
      paddingVertical: 6,
      justifyContent: 'center' as const,
    },
    toggleButtonHitSlop: {
      top: 9,
      bottom: 9,
      left: 4,
      right: 4,
    },
  };
}
