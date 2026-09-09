import { Text, TextInput, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { AppSwitch } from '@/src/components/common';
import {
  isNumericVisibilityOperator,
  isVisibilitySourceField,
  operatorsForVisibilitySource,
  visibilityConditionSummary,
} from '@/src/core/form/fieldVisibility';
import type {
  FieldVisibilityCondition,
  FieldVisibilityOperator,
  FormDefinition,
  FormField,
} from '@/src/core/form/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type FieldVisibilityEditorProps = {
  form: FormDefinition;
  field: FormField;
  condition: FieldVisibilityCondition | undefined;
  onChange: (condition: FieldVisibilityCondition | undefined) => void;
  title?: string;
  help?: string;
  switchLabel?: string;
};

const OPERATOR_LABELS: Record<FieldVisibilityOperator, string> = {
  eq: 'Yhtä kuin',
  neq: 'Eri kuin',
  gt: 'Suurempi kuin',
  lt: 'Pienempi kuin',
  gte: 'Suurempi tai yhtä suuri',
  lte: 'Pienempi tai yhtä suuri',
};

function defaultValueForSource(source: FormField): string {
  if (source.type === 'boolean') return 'true';
  if (source.type === 'select') return source.options?.[0]?.value ?? '';
  return '0';
}

function coerceOperator(
  source: FormField | undefined,
  operator: FieldVisibilityOperator | undefined,
): FieldVisibilityOperator {
  const allowed = operatorsForVisibilitySource(source);
  const current = operator ?? 'eq';
  return allowed.includes(current) ? current : 'eq';
}

export function FieldVisibilityEditor({
  form,
  field,
  condition,
  onChange,
  title = 'Näkyvyysehto',
  help = 'Piilota kenttä wizardissa kunnes ehto täyttyy. Sopii Kyllä/Ei-, valintalista-, numero- ja laskentakentille (esim. näytä räystäsmetrit vain jos räystäät = Kyllä, ikkunamäärä jos laskettu ehto = 1, tai lisärivi jos pinta-ala > 100).',
  switchLabel = 'Näytä vain jos ehto täyttyy',
}: FieldVisibilityEditorProps) {
  const styles = useThemedStyles(createStyles);
  const sources = form.fields.filter(
    (item) => item.id !== field.id && isVisibilitySourceField(item),
  );
  const enabled = Boolean(condition?.fieldKey);
  const selectedSource = sources.find((item) => item.key === condition?.fieldKey);
  const allowedOperators = operatorsForVisibilitySource(selectedSource);

  function enableWithDefault() {
    const first = sources[0];
    if (!first) return;
    onChange({
      fieldKey: first.key,
      operator: 'eq',
      value: defaultValueForSource(first),
    });
  }

  function patch(partial: Partial<FieldVisibilityCondition>) {
    if (!condition?.fieldKey && !partial.fieldKey) return;
    const fieldKey = partial.fieldKey ?? condition!.fieldKey;
    const source = sources.find((item) => item.key === fieldKey);
    const operator = coerceOperator(
      source,
      partial.operator ?? condition?.operator ?? 'eq',
    );
    const next: FieldVisibilityCondition = {
      fieldKey,
      operator,
      value: partial.value ?? condition?.value ?? 'true',
    };
    onChange(next);
  }

  function handleSourceChange(fieldKey: string) {
    const source = sources.find((item) => item.key === fieldKey);
    if (!source) return;
    const operator = coerceOperator(source, condition?.operator);
    onChange({
      fieldKey,
      operator,
      value: defaultValueForSource(source),
    });
  }

  const summary = visibilityConditionSummary(condition, form);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.help}>{help}</Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{switchLabel}</Text>
        <AppSwitch
          value={enabled}
          onValueChange={(value) => {
            if (value) enableWithDefault();
            else onChange(undefined);
          }}
          disabled={sources.length === 0}
        />
      </View>

      {sources.length === 0 ? (
        <Text style={styles.empty}>
          Lisää ensin Kyllä/Ei-, valintalista-, numero- tai laskentakenttä, johon ehto voi viitata.
        </Text>
      ) : null}

      {enabled && condition ? (
        <>
          <AppPicker
            label="Riippuu kentästä"
            selectedValue={condition.fieldKey}
            onValueChange={(value) => handleSourceChange(value)}
            items={sources.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
          />

          <AppPicker
            label="Vertailu"
            selectedValue={coerceOperator(selectedSource, condition.operator)}
            onValueChange={(value) => patch({ operator: value as FieldVisibilityOperator })}
            items={allowedOperators.map((op) => ({
              value: op,
              label: OPERATOR_LABELS[op],
            }))}
          />

          <View style={styles.valueWrap}>
            <Text style={styles.valueLabel}>Arvo</Text>
            {selectedSource?.type === 'boolean' ? (
              <AppPicker
                selectedValue={condition.value === 'true' ? 'true' : 'false'}
                onValueChange={(value) => patch({ value })}
                items={[
                  { label: 'Kyllä', value: 'true' },
                  { label: 'Ei', value: 'false' },
                ]}
              />
            ) : selectedSource?.type === 'number' || selectedSource?.type === 'computed' ? (
              <View style={styles.numberInputWrap}>
                <TextInput
                  style={styles.numberInput}
                  value={condition.value}
                  onChangeText={(value) => patch({ value })}
                  keyboardType="decimal-pad"
                  placeholder={
                    isNumericVisibilityOperator(condition.operator) ? 'esim. 100' : '0'
                  }
                  placeholderTextColor="#999"
                />
              </View>
            ) : (
              <AppPicker
                selectedValue={condition.value}
                onValueChange={(value) => patch({ value })}
                items={(selectedSource?.options ?? []).map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            )}
          </View>

          {summary ? <Text style={styles.summary}>Ehto: {summary}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      marginTop: 8,
      marginBottom: 12,
      gap: 8,
    },
    heading: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 16,
      color: colors.primary,
    },
    help: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
    },
    switchRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 12,
    },
    switchLabel: {
      flex: 1,
      fontFamily: 'IBMPlexSans_500Medium',
      color: colors.text,
    },
    valueWrap: {
      gap: 4,
    },
    valueLabel: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
      fontSize: 14,
    },
    numberInputWrap: {
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    numberInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 16,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    summary: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.accent,
      fontSize: 13,
    },
  };
}
