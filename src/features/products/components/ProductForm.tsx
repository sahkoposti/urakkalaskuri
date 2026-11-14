import { AppInput } from '@/src/components/common';
import { NAME_FIELD_KIND } from '@/src/components/textInputProps';
import {
  attributeFieldValues,
  ProductAttributeFields,
} from './ProductAttributeFields';
import { ProductPriceFields } from './ProductPriceFields';
import { ProductStructureAssignment } from './ProductStructureAssignment';
import type { Product } from '@/src/core/models/types';
import {
  productPurchasePriceVat0,
  productSalePriceVat0,
} from '@/src/core/product/productPricing';
import { productStructureIds } from '@/src/core/product/productStructures';
import type { ProductStructure } from '@/src/core/structure/types';
import { parseNumber } from '@/src/core/utils/formatters';

export type ProductFormValues = {
  name: string;
  unit: string;
  purchasePrice: string;
  salePrice: string;
  description: string;
  consumption: string;
  workFactor: string;
  structureIds: string[];
};

type ProductFormFieldsProps = {
  values: ProductFormValues;
  onChange: (patch: Partial<ProductFormValues>) => void;
  structures: ProductStructure[];
};

export function ProductFormFields({ values, onChange, structures }: ProductFormFieldsProps) {
  return (
    <>
      <AppInput label="Nimi *" value={values.name} onChangeText={(name) => onChange({ name })} kind={NAME_FIELD_KIND.productName} />
      <AppInput label="Yksikkö *" value={values.unit} onChangeText={(unit) => onChange({ unit })} kind="code" />
      <ProductPriceFields
        purchasePrice={values.purchasePrice}
        salePrice={values.salePrice}
        onPurchasePriceChange={(purchasePrice) => onChange({ purchasePrice })}
        onSalePriceChange={(salePrice) => onChange({ salePrice })}
      />
      <AppInput
        label="Kuvaus"
        value={values.description}
        onChangeText={(description) => onChange({ description })}
        kind="sentence"
        multiline
      />
      <ProductAttributeFields
        consumption={values.consumption}
        workFactor={values.workFactor}
        onConsumptionChange={(consumption) => onChange({ consumption })}
        onWorkFactorChange={(workFactor) => onChange({ workFactor })}
      />
      <ProductStructureAssignment
        structures={structures}
        selectedIds={values.structureIds}
        onChange={(structureIds) => onChange({ structureIds })}
      />
    </>
  );
}

export function parsedProductPrices(
  values: ProductFormValues,
): { purchase: number; sale: number } | { error: string } {
  if (!values.name.trim()) return { error: 'Anna nimi' };
  if (!values.unit.trim()) return { error: 'Anna yksikkö' };
  const parsedPurchase = parseNumber(values.purchasePrice);
  if (parsedPurchase === null || parsedPurchase < 0) return { error: 'Virheellinen ostohinta' };
  const parsedSale = parseNumber(values.salePrice);
  if (parsedSale === null || parsedSale < 0) return { error: 'Virheellinen myyntihinta' };
  return { purchase: parsedPurchase, sale: parsedSale };
}

export function productFormFromProduct(product: Product): ProductFormValues {
  const attrs = attributeFieldValues(product.attributes);
  return {
    name: product.name,
    unit: product.unit,
    purchasePrice: String(productPurchasePriceVat0(product)),
    salePrice: String(productSalePriceVat0(product)),
    description: product.description ?? '',
    consumption: attrs.consumption,
    workFactor: attrs.workFactor,
    structureIds: productStructureIds(product),
  };
}
