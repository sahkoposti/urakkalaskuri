import { Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { AppInput } from '@/src/components/common';
import { normalizeDefaultValue, supportsDefaultValue } from '@/src/core/form/fieldDefaultValue';
import { isProductField, selectedProductPickerValue } from '@/src/core/form/productFieldUtils';
import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type FieldDefaultValueEditorProps = {
  field: FormField;
  products: Product[];
  onChange: (defaultValue: string | undefined) => void;
};

export function FieldDefaultValueEditor({ field, products, onChange }: FieldDefaultValueEditorProps) {
  const styles = useThemedStyles(createStyles);

  if (!supportsDefaultValue(field)) return null;

  function setDefaultValue(value: string) {
    onChange(normalizeDefaultValue(value));
  }

  return (
    <View style={styles.wrap}>
      {field.type === 'select' ? (
        <AppPicker
          label="Oletusarvo"
          selectedValue={field.defaultValue ?? ''}
          onValueChange={setDefaultValue}
          placeholder="Ei oletusta"
          allowEmpty
          items={(field.options ?? []).map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />
      ) : isProductField(field) ? (
        <AppPicker
          label="Oletusarvo (tuote)"
          selectedValue={selectedProductPickerValue(products, field.defaultValue)}
          onValueChange={setDefaultValue}
          placeholder="Ei oletusta"
          allowEmpty
          items={products.map((product) => ({
            value: product.id,
            label: product.name,
          }))}
        />
      ) : field.type === 'boolean' ? (
        <AppPicker
          label="Oletusarvo"
          selectedValue={field.defaultValue ?? ''}
          onValueChange={setDefaultValue}
          placeholder="Ei oletusta"
          allowEmpty
          items={[
            { label: 'Kyllä', value: 'true' },
            { label: 'Ei', value: 'false' },
          ]}
        />
      ) : (
        <AppInput
          label="Oletusarvo"
          value={field.defaultValue ?? ''}
          onChangeText={setDefaultValue}
          keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
          placeholder={field.type === 'number' ? 'Esim. 120' : 'Valinnainen'}
          compact
        />
      )}
      <Text style={styles.help}>
        Näytetään wizardissa valmiina arvona. Tyhjä = ei oletusta. Käyttäjä voi muokata arvoa
        lomakkeella.
      </Text>
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    wrap: {
      marginBottom: 4,
    },
    help: {
      marginTop: -4,
      marginBottom: 8,
      color: colors.text,
      opacity: 0.75,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 18,
    },
  };
}
