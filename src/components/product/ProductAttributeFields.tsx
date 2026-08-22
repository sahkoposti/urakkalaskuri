import { attributeFieldValues, buildProductAttributes } from '@/src/core/product/productAttributes';
import { AppInput } from '@/src/components/common';

type ProductAttributeFieldsProps = {
  consumption: string;
  workFactor: string;
  onConsumptionChange: (value: string) => void;
  onWorkFactorChange: (value: string) => void;
};

export function ProductAttributeFields({
  consumption,
  workFactor,
  onConsumptionChange,
  onWorkFactorChange,
}: ProductAttributeFieldsProps) {
  return (
    <>
      <AppInput
        label="Menekki (valinnainen) · kaavassa menekki"
        value={consumption}
        onChangeText={onConsumptionChange}
        keyboardType="decimal-pad"
        placeholder="Esim. 8 (m²/l)"
      />
      <AppInput
        label="Työkerroin (valinnainen) · kaavassa tyokerroin"
        value={workFactor}
        onChangeText={onWorkFactorChange}
        keyboardType="decimal-pad"
        placeholder="Esim. 1.2"
      />
    </>
  );
}

export { attributeFieldValues, buildProductAttributes };
