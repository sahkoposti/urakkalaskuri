import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OutlinedButton, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { WIZARD_STEP_META, DEFAULT_WIZARD_STEP_ORDER, type WizardStepId } from '@/src/core/models/types';
import { moveWizardStep } from '@/src/core/wizard/wizardSteps';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function WizardOrderSettingsScreen() {
  const { ready, settings, refreshSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const [order, setOrder] = useState<WizardStepId[]>(settings.wizardStepOrder);

  useEffect(() => {
    setOrder(settings.wizardStepOrder);
  }, [settings.wizardStepOrder]);

  if (!ready) return <ScreenLoading />;

  async function handleSave() {
    await db.saveSettings({
      ...settings,
      wizardStepOrder: order,
    });
    await refreshSettings();
    showAlert('Tallennettu', 'Kysymysjärjestys tallennettu', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  function moveStep(index: number, direction: -1 | 1) {
    setOrder((current) => moveWizardStep(current, index, direction));
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Järjestys' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.helpText}>
          Järjestä laskennan vaiheet haluamaasi järjestykseen. Muutos vaikuttaa uusiin laskentoihin.
        </Text>
        {order.map((stepId, index) => (
          <View key={stepId} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.index}>{index + 1}.</Text>
              <Text style={styles.label}>{WIZARD_STEP_META[stepId].title}</Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                disabled={index === 0}
                onPress={() => moveStep(index, -1)}
              >
                <Text style={styles.moveButtonText}>↑</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.moveButton,
                  index === order.length - 1 && styles.moveButtonDisabled,
                ]}
                disabled={index === order.length - 1}
                onPress={() => moveStep(index, 1)}
              >
                <Text style={styles.moveButtonText}>↓</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <View style={styles.buttons}>
          <OutlinedButton
            title="Palauta oletus"
            onPress={() => setOrder([...DEFAULT_WIZARD_STEP_ORDER])}
          />
          <PrimaryButton title="Tallenna" onPress={handleSave} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  helpText: {
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.secondary,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    padding: 14,
  },
  rowText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  index: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.accent,
    width: 24,
  },
  label: {
    flex: 1,
    fontFamily: 'IBMPlexSans_500Medium',
    color: AppColors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  moveButton: {
    width: 36,
    height: 36,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.secondary,
  },
  moveButtonDisabled: {
    opacity: 0.35,
  },
  moveButtonText: {
    color: AppColors.accent,
    fontSize: 18,
    fontFamily: 'IBMPlexSans_700Bold',
    lineHeight: 20,
  },
  buttons: {
    marginTop: 12,
    gap: 12,
  },
});
