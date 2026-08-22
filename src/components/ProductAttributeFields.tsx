import { StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/src/components/common';
import { AppColors } from '@/src/theme/colors';

export type ProductAttributeForm = {
  consumption: string;
  purchasePrice: string;
  salePrice: string;
  workFactor: string;
  materialFactor: string;
};

type ProductAttributeFieldsProps = {
  values: ProductAttributeForm;
  onChange: (patch: Partial<ProductAttributeForm>) => void;
};

export function ProductAttributeFields({ values, onChange }: ProductAttributeFieldsProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Laskenta-attribuutit</Text>
      <Text style={styles.help}>
        Valinnaiset arvot kaavoille (esim. kautettavamaali.consumption).
      </Text>
      <AppInput
        label="Menekki"
        value={values.consumption}
        onChangeText={(consumption) => onChange({ consumption })}
        keyboardType="decimal-pad"
        placeholder="esim. 8"
      />
      <AppInput
        label="Ostohinta €"
        value={values.purchasePrice}
        onChangeText={(purchasePrice) => onChange({ purchasePrice })}
        keyboardType="decimal-pad"
      />
      <AppInput
        label="Myyntihinta €"
        value={values.salePrice}
        onChangeText={(salePrice) => onChange({ salePrice })}
        keyboardType="decimal-pad"
      />
      <AppInput
        label="Työkerroin"
        value={values.workFactor}
        onChangeText={(workFactor) => onChange({ workFactor })}
        keyboardType="decimal-pad"
      />
      <AppInput
        label="Materiaalikerroin"
        value={values.materialFactor}
        onChangeText={(materialFactor) => onChange({ materialFactor })}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
    marginBottom: 4,
  },
  help: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
});
