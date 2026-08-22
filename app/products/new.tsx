import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppInput, PrimaryButton } from '@/src/components/common';
import { ProductAttributeFields, type ProductAttributeForm } from '@/src/components/ProductAttributeFields';
import { buildProductAttributes } from '@/src/core/form/productAttributes';
import { parseNumber } from '@/src/core/utils/formatters';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';

export default function NewProductScreen() {
  const { refreshProducts } = useApp();
  const { showAlert } = useThemedAlert();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kpl');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [attributes, setAttributes] = useState<ProductAttributeForm>({
    consumption: '',
    purchasePrice: '',
    salePrice: '',
    workFactor: '',
    materialFactor: '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (saving) return;

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

    setSaving(true);
    try {
      await db.upsertProduct({
        id: createId(),
        name: name.trim(),
        unit: unit.trim(),
        unitPriceVat0: parsedPrice,
        description: description.trim() || undefined,
        attributes: buildProductAttributes(attributes),
        createdAt: new Date(),
      });
      await refreshProducts();
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tuotteen tallennus epäonnistui.';
      showAlert('Virhe', message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Lisää tuote' }} />
      <ScrollView contentContainerStyle={styles.content}>
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
        <ProductAttributeFields
          values={attributes}
          onChange={(patch) => setAttributes((current) => ({ ...current, ...patch }))}
        />
        <PrimaryButton title="Tallenna" onPress={handleSave} disabled={saving} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 4,
    paddingBottom: 32,
  },
});
