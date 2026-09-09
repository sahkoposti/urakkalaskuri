import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import { PrimaryButton, ScreenLoading } from '@/src/components/common';
import {
  buildProductAttributes,
} from '@/src/components/product/ProductAttributeFields';
import {
  parsedProductPrices,
  ProductFormFields,
  productFormFromProduct,
  type ProductFormValues,
} from '@/src/components/product/ProductForm';
import { duplicateProduct, nextProductSortOrder } from '@/src/core/product/productMutations';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: '',
  unit: 'kpl',
  purchasePrice: '',
  salePrice: '',
  description: '',
  consumption: '',
  workFactor: '',
  structureIds: [],
};

export default function NewProductScreen() {
  const styles = useThemedStyles(createStyles);
  const { copyFrom: rawCopyFrom } = useLocalSearchParams<{ copyFrom?: string | string[] }>();
  const copyFromId = Array.isArray(rawCopyFrom) ? rawCopyFrom[0] : rawCopyFrom;
  const { products, refreshProducts, structures } = useApp();
  const { showAlert } = useThemedAlert();
  const [loadingCopy, setLoadingCopy] = useState(Boolean(copyFromId));
  const [values, setValues] = useState<ProductFormValues>(EMPTY_PRODUCT_FORM);
  const [hydrated, setHydrated] = useState(!copyFromId);

  useEffect(() => {
    if (!copyFromId) return;
    let active = true;
    (async () => {
      const source = await db.getProduct(copyFromId);
      if (!active) return;
      if (source) {
        setValues(productFormFromProduct(duplicateProduct(source)));
      }
      setHydrated(true);
      setLoadingCopy(false);
    })();
    return () => {
      active = false;
    };
  }, [copyFromId]);

  const isDirty = useMemo(() => {
    if (!hydrated) return false;
    if (copyFromId) return true;
    return (
      values.name.trim().length > 0 ||
      values.unit.trim() !== 'kpl' ||
      values.purchasePrice.trim().length > 0 ||
      values.salePrice.trim().length > 0 ||
      values.description.trim().length > 0 ||
      values.consumption.trim().length > 0 ||
      values.workFactor.trim().length > 0 ||
      values.structureIds.length > 0
    );
  }, [hydrated, copyFromId, values]);

  async function persistProduct(): Promise<boolean> {
    const parsed = parsedProductPrices(values);
    if ('error' in parsed) {
      showAlert('Virhe', parsed.error);
      return false;
    }

    await db.upsertProduct({
      id: createId(),
      name: values.name.trim(),
      unit: values.unit.trim(),
      unitPriceVat0: parsed.purchase,
      purchasePriceVat0: parsed.purchase,
      salePriceVat0: parsed.sale,
      description: values.description.trim() || undefined,
      attributes: buildProductAttributes(values.consumption, values.workFactor),
      structureIds: values.structureIds,
      structureId: values.structureIds[0],
      sortOrder: nextProductSortOrder(products),
      createdAt: new Date(),
    });
    await refreshProducts();
    return true;
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistProduct,
  });

  if (loadingCopy) return <ScreenLoading />;

  async function handleSave() {
    const saved = await save();
    if (!saved) return;
    allowExit();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: copyFromId ? 'Kopioi tuote' : 'Lisää tuote' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ProductFormFields
          values={values}
          onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          structures={structures}
        />
        <PrimaryButton title="Tallenna" onPress={() => void handleSave()} />
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
