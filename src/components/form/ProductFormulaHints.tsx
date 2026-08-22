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

export function ProductFormulaHints({ form, field }: ProductFormulaHintsProps) {
  const productFields = field ? [field] : productFieldsInForm(form);
  if (productFields.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Tuotelistan muuttujat kaavoissa</Text>
      <Text style={styles.help}>
        Vaihtoehdot tulevat tuoterekisteristä. Nimi näkyy lomakkeella ja yhteenvedossa. Hinta ja
        menekki tulevat valitusta tuotteesta kaavamuuttujina.
      </Text>
      {productFields.map((productField) => (
        <View key={productField.id} style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>
            {productField.label} ({productField.key})
          </Text>
          {PRODUCT_FORMULA_ATTRIBUTES.map((attribute) => (
            <Text key={attribute.key} style={styles.ident}>
              {productField.key}.{attribute.key}
              {'  '}
              <Text style={styles.identLabel}>{attribute.label}</Text>
            </Text>
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
    gap: 6,
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
    marginTop: 4,
    gap: 2,
  },
  fieldLabel: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
    fontSize: 13,
  },
  ident: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.primary,
    fontSize: 13,
  },
  identLabel: {
    color: AppColors.text,
  },
});
