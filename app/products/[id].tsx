import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import {
  OutlinedButton,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import {
  attributeFieldValues,
  buildProductAttributes,
} from '@/src/components/product/ProductAttributeFields';
import {
  parsedProductPrices,
  ProductFormFields,
  productFormFromProduct,
  type ProductFormValues,
} from '@/src/components/product/ProductForm';
import type { Product } from '@/src/core/models/types';
import { productStructureIds, sameStructureIds } from '@/src/core/product/productStructures';
import {
  productPurchasePriceVat0,
  productSalePriceVat0,
  withProductPrices,
} from '@/src/core/product/productPricing';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function EditProductScreen() {
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshProducts, structures } = useApp();
  const { showAlert } = useThemedAlert();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [values, setValues] = useState<ProductFormValues>(productFormFromProduct({
    id: '',
    name: '',
    unit: '',
    unitPriceVat0: 0,
    createdAt: new Date(),
  }));

  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await db.getProduct(id);
      if (!active) return;
      if (loaded) {
        setProduct(loaded);
        setValues(productFormFromProduct(loaded));
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const isDirty = useMemo(() => {
    if (!product) return false;
    const savedAttrs = attributeFieldValues(product.attributes);
    return (
      values.name !== product.name ||
      values.unit !== product.unit ||
      values.purchasePrice !== String(productPurchasePriceVat0(product)) ||
      values.salePrice !== String(productSalePriceVat0(product)) ||
      values.description !== (product.description ?? '') ||
      values.consumption !== savedAttrs.consumption ||
      values.workFactor !== savedAttrs.workFactor ||
      !sameStructureIds(values.structureIds, productStructureIds(product))
    );
  }, [product, values]);

  async function persistProduct(): Promise<boolean> {
    if (!product) return false;
    const parsed = parsedProductPrices(values);
    if ('error' in parsed) {
      showAlert('Virhe', parsed.error);
      return false;
    }

    const next: Product = withProductPrices(
      {
        ...product,
        name: values.name.trim(),
        unit: values.unit.trim(),
        description: values.description.trim() || undefined,
        attributes: buildProductAttributes(values.consumption, values.workFactor),
        structureIds: values.structureIds,
        structureId: values.structureIds[0],
      },
      parsed.purchase,
      parsed.sale,
    );
    await db.upsertProduct(next);
    await refreshProducts();
    setProduct(next);
    return true;
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistProduct,
  });

  if (loading) return <ScreenLoading />;
  if (!product) return <ScreenMessage message="Tuotetta ei löytynyt." />;

  async function handleSave() {
    const saved = await save();
    if (!saved) return;
    allowExit();
    router.back();
  }

  function handleDuplicate() {
    router.push({ pathname: '/products/new', params: { copyFrom: product!.id } });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Muokkaa tuotetta' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProductFormFields
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          structures={structures}
        />
        <PrimaryButton title="Tallenna" onPress={() => void handleSave()} />
        <OutlinedButton title="Kopioi uudeksi tuotteeksi" onPress={handleDuplicate} />
      </ScrollView>
      {exitDialog}
    </>
  );
}

function createStyles(_colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      gap: 4,
      paddingBottom: 32,
    },
  };
}
