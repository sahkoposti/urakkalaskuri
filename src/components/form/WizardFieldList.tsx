import { Text, View, Pressable } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppPicker } from '@/src/components/AppPicker';
import { AppInput, AppSwitch, SectionTitle } from '@/src/components/common';
import { isComputedFieldOverridden } from '@/src/core/form/applyFieldValueChange';
import { visibleHelpText } from '@/src/core/form/fieldHelpText';
import { resolveFieldRawValue } from '@/src/core/form/fieldDefaultValue';
import { filterVisibleFields } from '@/src/core/form/fieldVisibility';
import {
  findProductById,
  getSelectedProductId,
  isProductField,
} from '@/src/core/form/productFieldUtils';
import { isSystemField } from '@/src/core/form/systemFields';
import type { FormDefinition, FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import { productConsumption, productWorkFactor } from '@/src/core/product/productAttributes';
import { formatCurrency, formatDecimal } from '@/src/core/utils/formatters';
import type { AppColorPalette } from '@/src/theme/colors';
import { useAppColors } from '@/src/theme/ThemeContext';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type WizardFieldListProps = {
  form: FormDefinition;
  fields: FormField[];
  fieldValues: Record<string, string>;
  computedValues: Record<string, number>;
  products: Product[];
  onChange: (key: string, value: string) => void;
  onResetOverride: (key: string) => void;
};

export function WizardFieldList({
  form,
  fields,
  fieldValues,
  computedValues,
  products,
  onChange,
  onResetOverride,
}: WizardFieldListProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useAppColors();
  const visibleFields = filterVisibleFields(fields, fieldValues, form, computedValues);

  return (
    <View style={styles.wrap}>
      {visibleFields.map((field) => {
        if (field.type === 'section') {
          return <SectionTitle key={field.id} title={field.label} />;
        }

        const help = visibleHelpText(field.helpText);

        if (field.type === 'computed') {
          const computed = computedValues[field.key];
          const canOverride = field.allowManualOverride !== false;
          const computedText =
            computed !== undefined && Number.isFinite(computed) ? formatDecimal(computed) : '';
          const overrideRaw = fieldValues[field.key];
          const isOverridden = isComputedFieldOverridden(form, fieldValues, field.key);

          if (canOverride) {
            const label = `${field.label}${field.unit ? ` (${field.unit})` : ''}`;
            return (
              <View key={field.id}>
                <AppInput
                  label={label}
                  value={isOverridden ? overrideRaw ?? '' : computedText}
                  onChangeText={(value) => onChange(field.key, value)}
                  keyboardType="decimal-pad"
                  placeholder={computedText || 'Esim. 5'}
                  trailing={
                    isOverridden ? (
                      <Pressable
                        onPress={() => onResetOverride(field.key)}
                        style={({ pressed }) => [
                          styles.resetButton,
                          pressed && styles.resetButtonPressed,
                        ]}
                        accessibilityLabel="Palauta laskettu arvo"
                        hitSlop={8}
                      >
                        <SymbolView
                          name="arrow.counterclockwise"
                          size={18}
                          tintColor={colors.accent}
                        />
                      </Pressable>
                    ) : null
                  }
                />
                {isOverridden ? (
                  <Text style={styles.overrideHint}>
                    Manuaalinen arvo – paina nuoli-painiketta palauttaaksesi laskennan
                  </Text>
                ) : null}
                {help ? <Text style={styles.hint}>{help}</Text> : null}
              </View>
            );
          }

          const display = computed !== undefined && Number.isFinite(computed)
            ? field.unit === '€'
              ? formatCurrency(computed)
              : `${computedText}${field.unit ? ` ${field.unit}` : ''}`
            : '–';
          return (
            <View key={field.id} style={styles.readOnlyField}>
              <Text style={styles.inputLabel}>{field.label}</Text>
              <Text style={styles.readOnlyValue}>{display}</Text>
              {help ? <Text style={styles.hint}>{help}</Text> : null}
            </View>
          );
        }

        if (isSystemField(field)) return null;

        if (isProductField(field)) {
          const selectedId = getSelectedProductId(fieldValues, field.key, field) ?? '';
          const selectedProduct = findProductById(products, selectedId);
          const consumption = selectedProduct
            ? productConsumption(selectedProduct.attributes)
            : undefined;
          const workFactor = selectedProduct
            ? productWorkFactor(selectedProduct.attributes)
            : undefined;

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
                  {consumption !== undefined ? ` · menekki ${formatDecimal(consumption)}` : ''}
                  {` · työkerroin ${formatDecimal(workFactor ?? 1)}`}
                </Text>
              ) : null}
              {help ? <Text style={styles.hint}>{help}</Text> : null}
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
                selectedValue={resolveFieldRawValue(field, fieldValues)}
                onValueChange={(value) => onChange(field.key, value)}
                placeholder="Valitse..."
                allowEmpty
                items={(field.options ?? []).map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
              {help ? <Text style={styles.hint}>{help}</Text> : null}
            </View>
          );
        }

        if (field.type === 'boolean') {
          const checked = resolveFieldRawValue(field, fieldValues) === 'true';
          return (
            <View key={field.id}>
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>{field.label}</Text>
                <AppSwitch
                  value={checked}
                  onValueChange={(value) => onChange(field.key, value ? 'true' : 'false')}
                />
              </View>
              {help ? <Text style={styles.hint}>{help}</Text> : null}
            </View>
          );
        }

        const label = `${field.label}${field.required ? ' *' : ''}${field.unit ? ` (${field.unit})` : ''}`;
        return (
          <View key={field.id}>
            <AppInput
              label={label}
              value={resolveFieldRawValue(field, fieldValues)}
              onChangeText={(value) => onChange(field.key, value)}
              keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
              placeholder={field.type === 'number' ? 'Esim. 120' : undefined}
              multiline={field.type === 'text'}
            />
            {help ? <Text style={styles.hint}>{help}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      gap: 4,
    },
    inputLabel: {
      marginBottom: 6,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
    },
    hint: {
      marginBottom: 12,
      color: colors.text,
      opacity: 0.75,
      fontFamily: 'IBMPlexSans_400Regular',
    },
    overrideHint: {
      marginTop: -8,
      marginBottom: 12,
      color: colors.text,
      opacity: 0.7,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 12,
    },
    resetButton: {
      padding: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.secondary,
    },
    resetButtonPressed: {
      opacity: 0.85,
    },
    productMeta: {
      marginTop: -4,
      marginBottom: 12,
      color: colors.text,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 18,
    },
    switchRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 12,
    },
    readOnlyField: {
      marginBottom: 12,
    },
    readOnlyValue: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.secondary,
    },
  };
}
