import { Picker } from '@react-native-picker/picker';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { AppInput, SectionTitle } from '@/src/components/common';
import { findProductById, getSelectedProductId, productQuantityValueKey } from '@/src/core/form/productFieldUtils';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import { formatCurrency, formatDecimal } from '@/src/core/utils/formatters';
import { AppColors } from '@/src/theme/colors';

type WizardFieldListProps = {
  fields: FormField[];
  fieldValues: Record<string, string>;
  computedValues: Record<string, number>;
  products: Product[];
  onChange: (key: string, value: string) => void;
};

export function WizardFieldList({
  fields,
  fieldValues,
  computedValues,
  products,
  onChange,
}: WizardFieldListProps) {
  return (
    <View style={styles.wrap}>
      {fields.map((field) => {
        if (isSystemField(field)) return null;

        if (field.type === 'section') {
          return <SectionTitle key={field.id} title={field.label} />;
        }

        if (field.type === 'computed') {
          const computed = computedValues[field.key];
          const display =
            computed !== undefined && Number.isFinite(computed)
              ? `${formatDecimal(computed)}${field.unit ? ` ${field.unit}` : ''}`
              : '–';
          return (
            <View key={field.id} style={styles.readOnlyField}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <Text style={styles.readOnlyValue}>{display}</Text>
            </View>
          );
        }

        if (field.type === 'product_select' || field.type === 'product_quantity') {
          const selectedId = getSelectedProductId(fieldValues, field.key) ?? '';
          const quantityKey = productQuantityValueKey(field.key);
          const selectedProduct = findProductById(products, selectedId);

          return (
            <View key={field.id}>
              <Text style={styles.inputLabel}>
                {field.label}
                {field.required ? ' *' : ''}
              </Text>
              {products.length === 0 ? (
                <Text style={styles.hint}>Ei tuotteita tuoterekisterissä.</Text>
              ) : (
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={selectedId}
                    onValueChange={(value) => onChange(field.key, value)}
                  >
                    <Picker.Item label="Valitse tuote..." value="" />
                    {products.map((product) => (
                      <Picker.Item
                        key={product.id}
                        label={`${product.name} (${formatCurrency(product.unitPriceVat0)}/${product.unit})`}
                        value={product.id}
                      />
                    ))}
                  </Picker>
                </View>
              )}
              {field.type === 'product_quantity' ? (
                <AppInput
                  label={`Määrä${selectedProduct ? ` (${selectedProduct.unit})` : ''}`}
                  value={fieldValues[quantityKey] ?? ''}
                  onChangeText={(value) => onChange(quantityKey, value)}
                  keyboardType="decimal-pad"
                  placeholder="Esim. 5"
                />
              ) : null}
            </View>
          );
        }

        if (field.type === 'select') {
          return (
            <View key={field.id}>
              <Text style={styles.inputLabel}>
                {field.label}
                {field.required ? ' *' : ''}
              </Text>
              <View style={styles.pickerWrap}>
                <Picker
                  selectedValue={fieldValues[field.key] ?? ''}
                  onValueChange={(value) => onChange(field.key, value)}
                >
                  <Picker.Item label="Valitse..." value="" />
                  {field.options?.map((option) => (
                    <Picker.Item key={option.value} label={option.label} value={option.value} />
                  ))}
                </Picker>
              </View>
            </View>
          );
        }

        if (field.type === 'boolean') {
          const checked = fieldValues[field.key] === 'true';
          return (
            <View key={field.id} style={styles.switchRow}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <Switch
                value={checked}
                onValueChange={(value) => onChange(field.key, value ? 'true' : 'false')}
              />
            </View>
          );
        }

        const label = `${field.label}${field.required ? ' *' : ''}${field.unit ? ` (${field.unit})` : ''}`;
        return (
          <AppInput
            key={field.id}
            label={label}
            value={fieldValues[field.key] ?? ''}
            onChangeText={(value) => onChange(field.key, value)}
            keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
            placeholder={field.type === 'number' ? 'Esim. 120' : undefined}
            multiline={field.type === 'text' && Boolean(field.helpText)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  inputLabel: {
    marginBottom: 6,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
  },
  hint: {
    marginBottom: 12,
    color: AppColors.text,
    opacity: 0.75,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    backgroundColor: AppColors.secondary,
    marginBottom: 12,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  readOnlyField: {
    marginBottom: 12,
  },
  readOnlyValue: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    backgroundColor: AppColors.secondary,
  },
});
