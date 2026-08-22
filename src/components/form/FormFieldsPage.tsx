import { Picker } from '@react-native-picker/picker';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/src/components/common';
import type { FieldValue, FormField } from '@/src/core/form/types';
import {
  fieldValueToInput,
  formatSummaryDisplay,
  parseInputValue,
  quantityToInput,
} from '@/src/core/form/fieldValues';
import type { Product } from '@/src/core/models/types';
import { formatCurrency } from '@/src/core/utils/formatters';
import { AppColors } from '@/src/theme/colors';

type FormFieldsPageProps = {
  fields: FormField[];
  values: Record<string, FieldValue>;
  computedValues?: Record<string, number>;
  products: Product[];
  onChange: (key: string, value: FieldValue) => void;
};

export function FormFieldsPage({
  fields,
  values,
  computedValues,
  products,
  onChange,
}: FormFieldsPageProps) {
  return (
    <View>
      {fields.map((field) => (
        <FieldControl
          key={field.id}
          field={field}
          value={values[field.key]}
          computedValue={computedValues?.[field.key]}
          products={products}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </View>
  );
}

type FieldControlProps = {
  field: FormField;
  value: FieldValue;
  computedValue?: number;
  products: Product[];
  onChange: (value: FieldValue) => void;
};

function FieldControl({ field, value, computedValue, products, onChange }: FieldControlProps) {
  if (field.type === 'section') {
    return <Text style={styles.section}>{field.label}</Text>;
  }

  if (field.type === 'computed') {
    const display =
      computedValue !== undefined && Number.isFinite(computedValue)
        ? formatSummaryDisplay(computedValue, field.unit)
        : '–';
    return (
      <View style={styles.computedWrap}>
        <Text style={styles.inputLabel}>{field.label}</Text>
        <Text style={styles.computedValue}>{display}</Text>
        {field.helpText ? <Text style={styles.help}>{field.helpText}</Text> : null}
      </View>
    );
  }

  const requiredMark = field.required ? ' *' : '';

  if (field.type === 'select') {
    return (
      <View>
        <Text style={styles.inputLabel}>
          {field.label}
          {requiredMark}
        </Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={typeof value === 'string' ? value : ''}
            onValueChange={(next) => onChange(next || null)}
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
    const flag = value === true;
    return (
      <View style={styles.toggleRow}>
        <Text style={styles.inputLabel}>
          {field.label}
          {requiredMark}
        </Text>
        <View style={styles.toggleActions}>
          <Pressable
            style={[styles.toggleButton, flag && styles.toggleButtonActive]}
            onPress={() => onChange(true)}
          >
            <Text style={[styles.toggleButtonText, flag && styles.toggleButtonTextActive]}>Kyllä</Text>
          </Pressable>
          <Pressable
            style={[styles.toggleButton, !flag && styles.toggleButtonActive]}
            onPress={() => onChange(false)}
          >
            <Text style={[styles.toggleButtonText, !flag && styles.toggleButtonTextActive]}>Ei</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (field.type === 'product_select' || field.type === 'product_quantity') {
    const productId =
      field.type === 'product_quantity' && value && typeof value === 'object' && 'productId' in value
        ? value.productId
        : typeof value === 'string'
          ? value
          : '';
    return (
      <View>
        <Text style={styles.inputLabel}>
          {field.label}
          {requiredMark}
        </Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={productId}
            onValueChange={(next) => {
              if (field.type === 'product_quantity') {
                onChange(parseInputValue(field, next, quantityToInput(value)));
                return;
              }
              onChange(next || null);
            }}
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
        {field.type === 'product_quantity' ? (
          <AppInput
            label="Määrä"
            value={quantityToInput(value)}
            onChangeText={(qty) => onChange(parseInputValue(field, productId, qty))}
            keyboardType="decimal-pad"
          />
        ) : null}
      </View>
    );
  }

  return (
    <AppInput
      label={`${field.label}${field.unit ? ` (${field.unit})` : ''}${requiredMark}`}
      value={fieldValueToInput(value)}
      onChangeText={(raw) => onChange(parseInputValue(field, raw))}
      keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
      multiline={field.type === 'text'}
      placeholder={field.helpText}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 12,
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
  },
  inputLabel: {
    marginBottom: 6,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
  },
  help: {
    marginTop: 4,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    backgroundColor: AppColors.secondary,
    marginBottom: 12,
    overflow: 'hidden',
  },
  computedWrap: {
    marginBottom: 12,
  },
  computedValue: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.accent,
    fontSize: 16,
  },
  toggleRow: {
    marginBottom: 12,
  },
  toggleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.accent,
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: AppColors.secondary,
  },
  toggleButtonActive: {
    backgroundColor: AppColors.accent,
  },
  toggleButtonText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.accent,
  },
  toggleButtonTextActive: {
    color: AppColors.secondary,
  },
});
