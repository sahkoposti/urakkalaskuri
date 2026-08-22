import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { AppInput, OutlinedButton, PrimaryButton, ScreenLoading, ScreenMessage } from '@/src/components/common';
import {
  attributeFieldValues,
  buildProductAttributes,
  ProductAttributeFields,
} from '@/src/components/product/ProductAttributeFields';
import type { Product } from '@/src/core/models/types';
import { duplicateProduct } from '@/src/core/product/productMutations';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshProducts } = useApp();
  const { showAlert } = useThemedAlert();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [consumption, setConsumption] = useState('');
  const [workFactor, setWorkFactor] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await db.getProduct(id);
      if (!active) return;
      if (loaded) {
        setProduct(loaded);
        setName(loaded.name);
        setUnit(loaded.unit);
        setPrice(String(loaded.unitPriceVat0));
        setDescription(loaded.description ?? '');
        const attrs = attributeFieldValues(loaded.attributes);
        setConsumption(attrs.consumption);
        setWorkFactor(attrs.workFactor);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <ScreenLoading />;
  if (!product) return <ScreenMessage message="Tuotetta ei löytynyt." />;

  async function handleSave() {
    if (!name.trim()) {
      showAlert('Virhe', 'Anna nimi');
      return;
    }
    if (!unit.trim()) {
      showAlert('Virhe', 'Anna yksikkö');
      return;
    }
    const parsedPrice = parseNumber(price);
    if (parsedPrice === null || parsedPrice < 0) {
      showAlert('Virhe', 'Virheellinen hinta');
      return;
    }

    await db.upsertProduct({
      ...product!,
      name: name.trim(),
      unit: unit.trim(),
      unitPriceVat0: parsedPrice,
      description: description.trim() || undefined,
      attributes: buildProductAttributes(consumption, workFactor),
    });
    await refreshProducts();
    router.back();
  }

  async function handleDuplicate() {
    const copy = duplicateProduct(product!);
    await db.upsertProduct(copy);
    await refreshProducts();
    router.replace(`/products/${copy.id}`);
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <AppInput label="Nimi *" value={name} onChangeText={setName} />
      <AppInput label="Yksikkö *" value={unit} onChangeText={setUnit} />
      <AppInput
        label="Yksikköhinta (alv0) € * · kaavassa yksikkohinta"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <AppInput
        label="Kuvaus"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <ProductAttributeFields
        consumption={consumption}
        workFactor={workFactor}
        onConsumptionChange={setConsumption}
        onWorkFactorChange={setWorkFactor}
      />
      <PrimaryButton title="Tallenna" onPress={handleSave} />
      <OutlinedButton title="Kopioi tuote" onPress={() => void handleDuplicate()} />
    </ScrollView>
  );
}
