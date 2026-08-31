import { useMemo } from 'react';
import { Text, View } from 'react-native';

import type { FormDefinition } from '@/src/core/form/types';
import { runDebugPipeline } from '@/src/core/form/pipeline';
import type { AppSettings, Product } from '@/src/core/models/types';
import { formatCurrency, formatDebugDecimal } from '@/src/core/utils/formatters';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

function formatDebugValue(form: FormDefinition, fieldKey: string, value: number): string {
  const field = form.fields.find((item) => item.key === fieldKey);
  if (field?.unit === '€') {
    return formatCurrency(value);
  }
  return formatDebugDecimal(value);
}

function contextNumber(context: Record<string, number>, fieldKey: string): number | undefined {
  const value = context[fieldKey];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

type FormulaDebugPanelProps = {
  form: FormDefinition;
  focusFieldKey: string;
  formula?: string;
  showIntermediateSteps?: boolean;
  settings: AppSettings;
  products?: Product[];
};

export function FormulaDebugPanel({
  form,
  focusFieldKey,
  formula,
  showIntermediateSteps = true,
  settings,
  products = [],
}: FormulaDebugPanelProps) {
  const styles = useThemedStyles(createStyles);
  const trace = useMemo(
    () => runDebugPipeline(form, focusFieldKey, { settings, products }),
    [form, focusFieldKey, settings, products],
  );

  const focusedStep = trace.steps.find((step) => step.fieldKey === focusFieldKey);
  const focusValue = contextNumber(trace.context, focusFieldKey);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Live-laskenta (debug)</Text>
      <Text style={styles.help}>
        Sama laskenta kuin wizardissa: syötteinä debug-esimerkkiarvot, materiaalirivejä ei simuloida.
        Materiaalit-muuttuja: {formatCurrency(trace.context.materiaalit ?? 0)} (alv0).
      </Text>

      {trace.errors.length > 0 ? (
        <View style={styles.errorBox}>
          {trace.errors.map((error) => (
            <Text key={error} style={styles.errorText}>
              • {error}
            </Text>
          ))}
        </View>
      ) : null}

      {formula ? (
        <View style={styles.block}>
          <Text style={styles.label}>Kaava</Text>
          <Text style={styles.mono}>{formula}</Text>
          {focusedStep?.substituted ? (
            <>
              <Text style={[styles.label, styles.spaced]}>Sijoitus</Text>
              <Text style={styles.mono}>{focusedStep.substituted}</Text>
            </>
          ) : null}
          {focusedStep?.error ? (
            <Text style={styles.errorText}>{focusedStep.error}</Text>
          ) : focusValue !== undefined ? (
            <Text style={styles.result}>
              Tulos: {formatDebugValue(form, focusFieldKey, focusValue)}
            </Text>
          ) : focusedStep && !Number.isNaN(focusedStep.result) ? (
            <Text style={styles.result}>
              Tulos: {formatDebugValue(form, focusedStep.fieldKey, focusedStep.result)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showIntermediateSteps ? (
        <>
          <Text style={[styles.label, styles.spaced]}>Välivaiheet</Text>
          {trace.steps.length === 0 ? (
            <Text style={styles.help}>Ei välivaiheita tälle kaavalle.</Text>
          ) : (
            trace.steps.map((step) => {
              const value = contextNumber(trace.context, step.fieldKey);
              return (
              <View key={step.fieldKey} style={styles.stepRow}>
                <Text style={styles.stepLabel}>{step.label}</Text>
                <Text style={styles.stepValue}>
                  {step.error ? '–' : formatDebugValue(form, step.fieldKey, value ?? step.result)}
                </Text>
              </View>
              );
            })
          )}
        </>
      ) : null}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      marginTop: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      backgroundColor: colors.surface,
    },
    title: {
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
      fontSize: 15,
      marginBottom: 6,
    },
    help: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 10,
    },
    errorBox: {
      marginBottom: 10,
      padding: 10,
      backgroundColor: '#FFF5F5',
      borderRadius: 5,
    },
    errorText: {
      fontFamily: 'IBMPlexSans_500Medium',
      color: colors.accent,
      fontSize: 13,
    },
    block: {
      marginBottom: 8,
    },
    label: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
      fontSize: 13,
      marginBottom: 4,
    },
    spaced: {
      marginTop: 8,
    },
    mono: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.primary,
      fontSize: 13,
    },
    result: {
      marginTop: 8,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.accent,
      fontSize: 15,
    },
    stepRow: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 4,
      gap: 12,
    },
    stepLabel: {
      flex: 1,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
    },
    stepValue: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
      fontSize: 13,
    },
  };
}
