import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { AppInput, PrimaryButton, ScreenLoading, ScreenMessage } from '@/src/components/common';
import type { Product } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshProducts } = useApp();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

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
      Alert.alert('Virhe', 'Anna nimi');
      return;
    }
    if (!unit.trim()) {
      Alert.alert('Virhe', 'Anna yksikkö');
      return;
    }
    const parsedPrice = parseNumber(price);
    if (parsedPrice === null || parsedPrice < 0) {
      Alert.alert('Virhe', 'Virheellinen hinta');
      return;
    }

    await db.upsertProduct({
      ...product!,
      name: name.trim(),
      unit: unit.trim(),
      unitPriceVat0: parsedPrice,
      description: description.trim() || undefined,
    });
    await refreshProducts();
    router.back();
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      <AppInput label="Nimi *" value={name} onChangeText={setName} />
      <AppInput label="Yksikkö *" value={unit} onChangeText={setUnit} />
      <AppInput
        label="Yksikköhinta (alv0) € *"
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
      <PrimaryButton title="Tallenna" onPress={handleSave} />
    </ScrollView>
  );
}
