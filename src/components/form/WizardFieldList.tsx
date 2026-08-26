import { StyleSheet, Switch, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { AppInput, SectionTitle } from '@/src/components/common';
import { filterVisibleFields } from '@/src/core/form/fieldVisibility';
import {
  findProductById,
  getSelectedProductId,
  isProductField,
} from '@/src/core/form/productFieldUtils';
import { isSystemField, isSystemFieldHiddenFromUi } from '@/src/core/form/systemFields';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import { formatCurrency, formatDecimal } from '@/src/core/utils/formatters';
import { AppColors } from '@/src/theme/colors';

type WizardFieldListProps = {
  form: FormDefinition;
  fields: FormField[];
  fieldValues: Record<string, string>;
  computedValues: Record<string, number>;
  products: Product[];
  onChange: (key: string, value: string) => void;
};

export function WizardFieldList({
  form,
  fields,
  fieldValues,
  computedValues,
  products,
  onChange,
}: WizardFieldListProps) {
  const visibleFields = filterVisibleFields(fields, fieldValues, form);

  return (
    <View style={styles.wrap}>
      {visibleFields.map((field) => {
        if (isSystemFieldHiddenFromUi(field)) return null;

        if (field.type === 'section') {
          return <SectionTitle key={field.id} title={field.label} />;
        }

        if (field.type === 'computed') {
          const computed = computedValues[field.key];
          const canOverride = field.allowManualOverride !== false;
          const computedText =
            computed !== undefined && Number.isFinite(computed)
              ? field.unit === '€'
                ? formatCurrency(computed)
                : formatDecimal(computed)
              : '';
          const overrideRaw = fieldValues[field.key];
          const isOverridden = overrideRaw !== undefined && overrideRaw.trim() !== '';

          if (canOverride) {
            const label = `${field.label}${field.unit ? ` (${field.unit})` : ''}`;
            return (
              <View key={field.id}>
                <AppInput
                  label={label}
                  value={isOverridden ? overrideRaw : computedText}
                  onChangeText={(value) => onChange(field.key, value)}
                  keyboardType="decimal-pad"
                  placeholder={computedText || 'Esim. 5'}
                />
                {isOverridden ? (
                  <Text style={styles.overrideHint}>
                    Manuaalinen arvo – tyhjennä kenttä palauttaaksesi kaavan
                  </Text>
                ) : null}
              </View>
            );
          }

          const display = computedText
            ? field.unit === '€'
              ? computedText
              : `${computedText}${field.unit ? ` ${field.unit}` : ''}`
            : '–';
          return (
            <View key={field.id} style={styles.readOnlyField}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <Text style={styles.readOnlyValue}>{display}</Text>
            </View>
          );
        }

        if (isSystemField(field)) return null;

        if (isProductField(field)) {
          const selectedId = getSelectedProductId(fieldValues, field.key) ?? '';
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
                <AppPicker
                  selectedValue={selectedId}
                  onValueChange={(value) => onChange(field.key, value)}
                  placeholder="Valitse tuote..."
                  allowEmpty
                  items={products.map((product) => ({
                    value: product.id,
                    label: `${product.name} (${formatCurrency(product.unitPriceVat0)}/${product.unit})`,
                  }))}
                />
              )}
              {selectedProduct ? (
                <Text style={styles.productMeta}>
                  {selectedProduct.name}
                  {' · '}
                  {formatCurrency(selectedProduct.unitPriceVat0)}/{selectedProduct.unit}
                  {selectedProduct.attributes?.consumption !== undefined
                    ? ` · menekki ${formatDecimal(selectedProduct.attributes.consumption)}`
                    : ''}
                </Text>
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
              <AppPicker
                selectedValue={fieldValues[field.key] ?? ''}
                onValueChange={(value) => onChange(field.key, value)}
                placeholder="Valitse..."
                allowEmpty
                items={(field.options ?? []).map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
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
                trackColor={{ true: AppColors.accent, false: AppColors.border }}
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
  overrideHint: {
    marginTop: -8,
    marginBottom: 12,
    color: AppColors.text,
    opacity: 0.7,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 12,
  },
  productMeta: {
    marginTop: -4,
    marginBottom: 12,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
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
