import { Picker } from '@react-native-picker/picker';
import { StyleSheet, Switch, Text, View } from 'react-native';

import {
  isVisibilitySourceField,
  visibilityConditionSummary,
} from '@/src/core/form/fieldVisibility';
import type {
  FieldVisibilityCondition,
  FormDefinition,
  FormField,
} from '@/src/core/form/types';
import { AppColors } from '@/src/theme/colors';

type FieldVisibilityEditorProps = {
  form: FormDefinition;
  field: FormField;
  onChange: (showWhen: FieldVisibilityCondition | undefined) => void;
};

export function FieldVisibilityEditor({ form, field, onChange }: FieldVisibilityEditorProps) {
  const sources = form.fields.filter(
    (item) => item.id !== field.id && isVisibilitySourceField(item),
  );
  const enabled = Boolean(field.showWhen?.fieldKey);
  const condition = field.showWhen;
  const selectedSource = sources.find((item) => item.key === condition?.fieldKey);

  function enableWithDefault() {
    const first = sources[0];
    if (!first) return;
    const value =
      first.type === 'boolean' ? 'true' : (first.options?.[0]?.value ?? '');
    onChange({ fieldKey: first.key, operator: 'eq', value });
  }

  function patch(partial: Partial<FieldVisibilityCondition>) {
    if (!condition?.fieldKey && !partial.fieldKey) return;
    const next: FieldVisibilityCondition = {
      fieldKey: partial.fieldKey ?? condition!.fieldKey,
      operator: partial.operator ?? condition?.operator ?? 'eq',
      value: partial.value ?? condition?.value ?? 'true',
    };
    onChange(next);
  }

  function handleSourceChange(fieldKey: string) {
    const source = sources.find((item) => item.key === fieldKey);
    if (!source) return;
    const value =
      source.type === 'boolean' ? 'true' : (source.options?.[0]?.value ?? '');
    onChange({ fieldKey, operator: condition?.operator ?? 'eq', value });
  }

  const summary = visibilityConditionSummary(condition, form);

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Näkyvyysehto</Text>
      <Text style={styles.help}>
        Piilota kenttä wizardissa kunnes ehto täyttyy. Sopii Kyllä/Ei- ja valintalistakentille
        (esim. näytä räystäsmetrit vain jos räystäät = Kyllä).
      </Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Näytä vain jos ehto täyttyy</Text>
        <Switch
          value={enabled}
          onValueChange={(value) => {
            if (value) enableWithDefault();
            else onChange(undefined);
          }}
          disabled={sources.length === 0}
          trackColor={{ true: AppColors.accent, false: AppColors.border }}
        />
      </View>

      {sources.length === 0 ? (
        <Text style={styles.empty}>
          Lisää ensin Kyllä/Ei- tai valintalistakenttä, johon ehto voi viitata.
        </Text>
      ) : null}

      {enabled && condition ? (
        <>
          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Riippuu kentästä</Text>
            <Picker
              selectedValue={condition.fieldKey}
              onValueChange={(value) => handleSourceChange(value)}
            >
              {sources.map((item) => (
                <Picker.Item key={item.id} label={item.label} value={item.key} />
              ))}
            </Picker>
          </View>

          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Vertailu</Text>
            <Picker
              selectedValue={condition.operator ?? 'eq'}
              onValueChange={(value) =>
                patch({ operator: value === 'neq' ? 'neq' : 'eq' })
              }
            >
              <Picker.Item label="Yhtä kuin" value="eq" />
              <Picker.Item label="Eri kuin" value="neq" />
            </Picker>
          </View>

          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Arvo</Text>
            {selectedSource?.type === 'boolean' ? (
              <Picker
                selectedValue={condition.value === 'true' ? 'true' : 'false'}
                onValueChange={(value) => patch({ value })}
              >
                <Picker.Item label="Kyllä" value="true" />
                <Picker.Item label="Ei" value="false" />
              </Picker>
            ) : (
              <Picker
                selectedValue={condition.value}
                onValueChange={(value) => patch({ value })}
              >
                {(selectedSource?.options ?? []).map((option) => (
                  <Picker.Item
                    key={option.value}
                    label={option.label}
                    value={option.value}
                  />
                ))}
              </Picker>
            )}
          </View>

          {summary ? <Text style={styles.summary}>Ehto: {summary}</Text> : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  heading: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 16,
    color: AppColors.primary,
  },
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  empty: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontFamily: 'IBMPlexSans_500Medium',
    color: AppColors.text,
  },
  pickerWrap: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  pickerLabel: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
    fontSize: 14,
  },
  summary: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.accent,
    fontSize: 13,
  },
});
