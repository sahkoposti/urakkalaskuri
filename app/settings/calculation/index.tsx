import * as Clipboard from 'expo-clipboard';
import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { OutlinedButton, SectionTitle } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import {
  FormDefinitionImportError,
  parseImportedFormDefinition,
  serializeFormDefinition,
} from '@/src/core/form/formDefinitionIo';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { db, useApp } from '@/src/context/AppContext';
import { useSaveToast } from '@/src/context/SaveToastContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function CalculationSettingsScreen() {
  const { formDefinition, refreshFormSettings } = useApp();
  const { showAlert } = useThemedAlert();
  const { showSaved } = useSaveToast();
  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [resetVisible, setResetVisible] = useState(false);

  async function handleExport() {
    await Clipboard.setStringAsync(serializeFormDefinition(formDefinition));
    showSaved('Lomakepohja kopioitu');
  }

  async function handleImport() {
    try {
      const imported = parseImportedFormDefinition(importText);
      await db.saveFormDefinition(imported, { preserveVersion: true });
      await refreshFormSettings();
      setImportVisible(false);
      setImportText('');
      showSaved('Lomakepohja tuotu');
    } catch (error) {
      const message =
        error instanceof FormDefinitionImportError
          ? error.message
          : 'Tuonti epäonnistui';
      showAlert('Virhe', message);
    }
  }

  async function handleResetDefault() {
    setResetVisible(false);
    const defaults = normalizeFormDefinition(createDefaultFormDefinition());
    await db.saveFormDefinition(defaults, { preserveVersion: true });
    await refreshFormSettings();
    showSaved('Oletuslomake palautettu');
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Lomakeasetukset' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Lomakeasetukset" />
        <SettingsNavCard
          title="Sivut"
          subtitle="Sivut, järjestys ja kenttien valinta lomakkeelle"
          onPress={() => router.push('/settings/calculation/pages' as Href)}
        />
        <SettingsNavCard
          title="Kentät"
          subtitle="Lisää kenttiä, valintalistoja ja kaavoja"
          onPress={() => router.push('/settings/calculation/fields' as Href)}
        />
        <SettingsNavCard
          title="Debug"
          subtitle="Live-laskenta kaavojen kalibrointiin"
          onPress={() => router.push('/settings/calculation/debug')}
        />

        <SectionTitle title="Lomakepohja" />
        <OutlinedButton title="Vie JSON (leikepöytä)" onPress={() => void handleExport()} />
        <OutlinedButton
          title="Tuo JSON…"
          onPress={() => {
            setImportText('');
            setImportVisible(true);
          }}
        />
        <OutlinedButton title="Palauta oletuslomake…" onPress={() => setResetVisible(true)} />
      </ScrollView>

      <Modal
        visible={importVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalDismiss} onPress={() => setImportVisible(false)} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tuo lomakepohja</Text>
              <Text style={styles.modalHelp}>
                Liitä aiemmin viety FormDefinition-JSON. Nykyinen lomakepohja korvataan.
              </Text>
              <View style={styles.importInputWrap}>
                <TextInput
                  style={styles.importInput}
                  value={importText}
                  onChangeText={setImportText}
                  multiline
                  scrollEnabled
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder='{"name":"…","pages":[],"fields":[]}'
                  placeholderTextColor={AppColors.border}
                />
              </View>
              {importText.trim() ? (
                <Text style={styles.importMeta}>JSON liitetty ({importText.length} merkkiä)</Text>
              ) : null}
              <View style={styles.modalActions}>
                <OutlinedButton title="Peruuta" onPress={() => setImportVisible(false)} />
                <OutlinedButton title="Tuo" onPress={() => void handleImport()} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={resetVisible}
        title="Palauta oletuslomake?"
        message="Nykyinen lomakepohja korvataan Peruslaskenta-oletuksella. Tätä ei voi peruuttaa."
        onClose={() => setResetVisible(false)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setResetVisible(false) },
          { title: 'Palauta', variant: 'destructive', onPress: () => void handleResetDefault() },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 10,
  },
  modalAvoid: {
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    backgroundColor: AppColors.secondary,
    borderRadius: 8,
    padding: 16,
    gap: 10,
    maxHeight: '80%',
    flexShrink: 1,
  },
  modalTitle: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 18,
    color: AppColors.primary,
  },
  modalHelp: {
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 13,
    color: AppColors.text,
    lineHeight: 20,
  },
  importInputWrap: {
    height: 120,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    backgroundColor: AppColors.surface,
    overflow: 'hidden',
  },
  importInput: {
    flex: 1,
    height: 120,
    padding: 10,
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 13,
    color: AppColors.text,
    textAlignVertical: 'top',
  },
  importMeta: {
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 12,
    color: AppColors.text,
    opacity: 0.75,
  },
  modalActions: {
    gap: 8,
    flexShrink: 0,
  },
});
