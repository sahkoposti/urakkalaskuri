import * as Clipboard from 'expo-clipboard';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OutlinedButton, ScreenMessage, SectionTitle } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { JsonImportField } from '@/src/components/form/JsonImportField';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import {
  FormDefinitionImportError,
  importedFormSummary,
  parseImportedFormDefinition,
  serializeFormDefinition,
} from '@/src/core/form/formDefinitionIo';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { useSaveToast } from '@/src/context/SaveToastContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useStructureFormEditor } from '@/src/hooks/useStructureFormEditor';
import type { AppColorPalette } from '@/src/theme/colors';
import { useAppColors } from '@/src/theme/ThemeContext';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function CalculationSettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const colors = useAppColors();
  const { formDefinition, persistForm, href, structure } = useStructureFormEditor();
  const { showAlert } = useThemedAlert();
  const { showSaved } = useSaveToast();
  const [importVisible, setImportVisible] = useState(false);
  const [importText, setImportText] = useState('');
  const [importFieldKey, setImportFieldKey] = useState(0);
  const [resetVisible, setResetVisible] = useState(false);
  const [discardImportVisible, setDiscardImportVisible] = useState(false);

  function resetImportField() {
    setImportText('');
    setImportFieldKey((key) => key + 1);
  }

  function requestCloseImport() {
    if (importText.trim()) {
      setDiscardImportVisible(true);
      return;
    }
    setImportVisible(false);
    resetImportField();
  }

  function discardImport() {
    setDiscardImportVisible(false);
    setImportVisible(false);
    resetImportField();
  }

  if (!formDefinition) {
    return <ScreenMessage message="Tuoterakennetta ei löytynyt." />;
  }

  const form = formDefinition;

  async function handleExport() {
    await Clipboard.setStringAsync(serializeFormDefinition(form));
    showSaved('Lomakepohja kopioitu');
  }

  async function handleImport() {
    try {
      const imported = parseImportedFormDefinition(importText);
      await persistForm(imported, { preserveVersion: true });
      setImportVisible(false);
      resetImportField();
      showAlert('Lomakepohja tuotu', importedFormSummary(imported));
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
    await persistForm(defaults, { preserveVersion: true });
    showSaved('Oletuslomake palautettu');
  }

  return (
    <>
      <Stack.Screen options={{ title: structure?.name ? `Lomake · ${structure.name}` : 'Lomakeasetukset' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionTitle title="Lomakeasetukset" />
        <SettingsNavCard
          title="Sivut"
          subtitle="Sivut, järjestys ja kenttien valinta lomakkeelle"
          onPress={() => router.push(href('/settings/calculation/pages'))}
        />
        <SettingsNavCard
          title="Kentät"
          subtitle="Lisää kenttiä, valintalistoja ja kaavoja"
          onPress={() => router.push(href('/settings/calculation/fields'))}
        />
        <SettingsNavCard
          title="Debug"
          subtitle="Live-laskenta kaavojen kalibrointiin"
          onPress={() => router.push(href('/settings/calculation/debug'))}
        />

        <SectionTitle title="Lomakepohja" />
        <OutlinedButton title="Vie JSON (leikepöytä)" onPress={() => void handleExport()} />
        <OutlinedButton
          title="Tuo JSON…"
          onPress={() => {
            resetImportField();
            setImportVisible(true);
          }}
        />
        <OutlinedButton title="Palauta oletuslomake…" onPress={() => setResetVisible(true)} />
      </ScrollView>

      <Modal
        visible={importVisible}
        transparent
        animationType="fade"
        onRequestClose={requestCloseImport}
      >
        <KeyboardAvoidingView
          style={styles.modalAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalDismiss} onPress={requestCloseImport} />
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tuo lomakepohja</Text>
              <Text style={styles.modalHelp}>
                Liitä aiemmin viety FormDefinition-JSON. Nykyinen lomakepohja korvataan.
              </Text>
              <View style={styles.importInputWrap}>
                <JsonImportField
                  fieldKey={`import-${importFieldKey}`}
                  onChangeText={setImportText}
                  placeholder='{"name":"…","pages":[],"fields":[]}'
                  placeholderColor={colors.border}
                  textColor={colors.text}
                  style={styles.importInput}
                />
              </View>
              {importText.trim() ? (
                <Text style={styles.importMeta}>JSON liitetty ({importText.length} merkkiä)</Text>
              ) : null}
              <View style={styles.modalActions}>
                <OutlinedButton title="Peruuta" onPress={requestCloseImport} />
                <OutlinedButton title="Tuo" onPress={() => void handleImport()} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ConfirmDialog
        visible={discardImportVisible}
        title="Tallentamattomia muutoksia"
        message="Haluatko hylätä liitetyn JSON-pohjan?"
        onClose={() => setDiscardImportVisible(false)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDiscardImportVisible(false) },
          { title: 'Hylkää', variant: 'destructive', onPress: discardImport },
        ]}
      />
      <ConfirmDialog
        visible={resetVisible}
        title="Palauta oletuslomake?"
        message="Nykyinen lomakepohja korvataan Julkisivumaalaus-oletuksella. Tätä ei voi peruuttaa."
        onClose={() => setResetVisible(false)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setResetVisible(false) },
          { title: 'Palauta', variant: 'destructive', onPress: () => void handleResetDefault() },
        ]}
      />
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
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
      justifyContent: 'center' as const,
      padding: 20,
    },
    modalDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    modalCard: {
      backgroundColor: colors.secondary,
      borderRadius: 8,
      padding: 16,
      gap: 10,
      maxHeight: '80%' as const,
      flexShrink: 1,
    },
    modalTitle: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 18,
      color: colors.primary,
    },
    modalHelp: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.text,
      lineHeight: 20,
    },
    importInputWrap: {
      height: 160,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 5,
      backgroundColor: colors.surface,
      overflow: 'hidden' as const,
    },
    importInput: {
      flex: 1,
      height: 160,
      padding: 10,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.text,
      textAlignVertical: 'top' as const,
    },
    importMeta: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 12,
      color: colors.text,
      opacity: 0.75,
    },
    modalActions: {
      gap: 8,
      flexShrink: 0,
    },
  };
}
