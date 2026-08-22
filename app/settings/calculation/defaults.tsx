import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { AppInput, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { FORM_DEFAULT_LABELS, defaultFormDefaults } from '@/src/core/form/formDefaults';
import { parseNumber } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';

export default function FormDefaultsScreen() {
  const { ready, formDefaults, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(
      Object.fromEntries(
        Object.keys(defaultFormDefaults).map((key) => [
          key,
          String(formDefaults[key] ?? defaultFormDefaults[key]).replace('.', ','),
        ]),
      ),
    );
  }, [formDefaults]);

  if (!ready) return <ScreenLoading />;

  async function handleSave() {
    const next: Record<string, number> = { ...defaultFormDefaults };
    for (const key of Object.keys(defaultFormDefaults)) {
      const parsed = parseNumber(values[key] ?? '');
      if (parsed === null || parsed < 0) {
        showAlert('Virhe', `Anna kelvollinen arvo: ${FORM_DEFAULT_LABELS[key] ?? key}`);
        return;
      }
      next[key] = parsed;
    }
    await db.saveFormDefaults(next);
    await refreshFormSettings();
    showAlert('Tallennettu', 'Oletusarvot tallennettu', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Oletusarvot' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {Object.keys(defaultFormDefaults).map((key) => (
          <AppInput
            key={key}
            label={FORM_DEFAULT_LABELS[key] ?? key}
            value={values[key] ?? ''}
            onChangeText={(value) => setValues((current) => ({ ...current, [key]: value }))}
            keyboardType="decimal-pad"
          />
        ))}
        <PrimaryButton title="Tallenna" onPress={() => void handleSave()} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
});
