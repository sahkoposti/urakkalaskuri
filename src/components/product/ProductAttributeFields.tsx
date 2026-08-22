import { attributeFieldValues, buildProductAttributes } from '@/src/core/product/productAttributes';
import { AppInput, PrimaryButton } from '@/src/components/common';

type ProductAttributeFieldsProps = {
  consumption: string;
  workFactor: string;
  materialFactor: string;
  onConsumptionChange: (value: string) => void;
  onWorkFactorChange: (value: string) => void;
  onMaterialFactorChange: (value: string) => void;
};

export function ProductAttributeFields({
  consumption,
  workFactor,
  materialFactor,
  onConsumptionChange,
  onWorkFactorChange,
  onMaterialFactorChange,
}: ProductAttributeFieldsProps) {
  return (
    <>
      <AppInput
        label="Menekki (valinnainen)"
        value={consumption}
        onChangeText={onConsumptionChange}
        keyboardType="decimal-pad"
        placeholder="Esim. 8 (m²/l)"
      />
      <AppInput
        label="Työkerroin (valinnainen)"
        value={workFactor}
        onChangeText={onWorkFactorChange}
        keyboardType="decimal-pad"
        placeholder="Esim. 1.2"
      />
      <AppInput
        label="Materiaalikerroin (valinnainen)"
        value={materialFactor}
        onChangeText={onMaterialFactorChange}
        keyboardType="decimal-pad"
        placeholder="Esim. 1.0"
      />
    </>
  );
}

export { attributeFieldValues, buildProductAttributes };
