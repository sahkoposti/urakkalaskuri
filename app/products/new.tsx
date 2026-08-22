import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { v4 as uuidv4 } from 'uuid';

import { AppInput, PrimaryButton } from '@/src/components/common';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';

export default function NewProductScreen() {
  const { refreshProducts } = useApp();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kpl');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

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
      id: uuidv4(),
      name: name.trim(),
      unit: unit.trim(),
      unitPriceVat0: parsedPrice,
      description: description.trim() || undefined,
      createdAt: new Date(),
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
