import { StyleSheet, Text, View } from 'react-native';

import {
  PRODUCT_FORMULA_ATTRIBUTES,
  productFieldsInForm,
} from '@/src/core/form/productContext';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import { AppColors } from '@/src/theme/colors';

type ProductFormulaHintsProps = {
  form: FormDefinition;
  field?: FormField;
};

function VariableRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.variableRow}>
      <Text style={styles.variableLabel}>{label}</Text>
      <Text style={styles.variableValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export function ProductFormulaHints({ form, field }: ProductFormulaHintsProps) {
  const productFields = field ? [field] : productFieldsInForm(form);
  if (productFields.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Kaavamuuttujat</Text>
      <Text style={styles.help}>
        Valitun tuotteen menekki ja hinta tulevat kaavoihin näillä nimillä. Nimi näkyy lomakkeella,
        ei kaavassa.
      </Text>
      {productFields.map((productField) => (
        <View key={productField.id} style={styles.fieldBlock}>
          {!field ? (
            <Text style={styles.fieldLabel}>
              {productField.label} ({productField.key})
            </Text>
          ) : null}
          {PRODUCT_FORMULA_ATTRIBUTES.map((attribute) => (
            <VariableRow
              key={attribute.key}
              label={attribute.label}
              value={productField.key ? `${productField.key}.${attribute.key}` : `… .${attribute.key}`}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    backgroundColor: AppColors.surface,
    gap: 8,
  },
  heading: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 15,
    color: AppColors.primary,
  },
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
    fontSize: 13,
  },
  variableRow: {
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  variableLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
    fontSize: 14,
    marginBottom: 2,
  },
  variableValue: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.primary,
    fontSize: 15,
  },
});
