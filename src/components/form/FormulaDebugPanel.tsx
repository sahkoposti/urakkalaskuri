import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FormDefinition } from '@/src/core/form/types';
import { runDebugPipeline } from '@/src/core/form/pipeline';
import { formatDecimal } from '@/src/core/utils/formatters';
import { AppColors } from '@/src/theme/colors';

type FormulaDebugPanelProps = {
  form: FormDefinition;
  focusFieldKey: string;
  formula?: string;
};

export function FormulaDebugPanel({ form, focusFieldKey, formula }: FormulaDebugPanelProps) {
  const trace = useMemo(
    () => runDebugPipeline(form, focusFieldKey),
    [form, focusFieldKey],
  );

  const focusedStep = trace.steps.find((step) => step.fieldKey === focusFieldKey);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Live-laskenta (debug)</Text>
      <Text style={styles.help}>
        Esimerkkiarvot tulevat kunkin syötekentän debug-kentästä. Pipeline yhdistää ne koko
        logiikan mukaisesti.
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
          ) : focusedStep && !Number.isNaN(focusedStep.result) ? (
            <Text style={styles.result}>Tulos: {formatDecimal(focusedStep.result)}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={[styles.label, styles.spaced]}>Välivaiheet</Text>
      {trace.steps.map((step) => (
        <View key={step.fieldKey} style={styles.stepRow}>
          <Text style={styles.stepLabel}>{step.label}</Text>
          <Text style={styles.stepValue}>
            {step.error ? '–' : formatDecimal(step.result)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.accent,
    borderRadius: 5,
    backgroundColor: AppColors.surface,
  },
  title: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 15,
    marginBottom: 6,
  },
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
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
    color: AppColors.accent,
    fontSize: 13,
  },
  block: {
    marginBottom: 8,
  },
  label: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
    fontSize: 13,
    marginBottom: 4,
  },
  spaced: {
    marginTop: 8,
  },
  mono: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.primary,
    fontSize: 13,
  },
  result: {
    marginTop: 8,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.accent,
    fontSize: 15,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 12,
  },
  stepLabel: {
    flex: 1,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
  },
  stepValue: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
    fontSize: 13,
  },
});
