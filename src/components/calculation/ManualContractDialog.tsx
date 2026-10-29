import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppInput, OutlinedButton, PrimaryButton } from '@/src/components/common';
import { parseManualContractInputs } from '@/src/core/pdf/manualContract';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type ManualContractDialogProps = {
  visible: boolean;
  /** Rivit, joilta urakka puuttuu (linesNeedingManualContract). */
  lines: { id: string; name: string }[];
  onSubmit: (values: Record<string, number>) => void;
  onCancel: () => void;
};

/** Urakkakortti: kysyy tekijöiden urakan (alv0) riveille, joilla lomaketta ei käytetty. */
export function ManualContractDialog({ visible, lines, onSubmit, onCancel }: ManualContractDialogProps) {
  const styles = useThemedStyles(createStyles);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setInputs(Object.fromEntries(lines.map((line) => [line.id, ''])));
      setError(null);
    }
  }, [visible, lines]);

  const handleSubmit = () => {
    const parsed = parseManualContractInputs(inputs);
    if (!parsed.ok) {
      setError('Anna urakka euroina (suurempi kuin 0) jokaiselle riville.');
      return;
    }
    onSubmit(parsed.values);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onCancel} />
        <View style={styles.dialog}>
          <Text style={styles.title}>Tekijöiden urakka</Text>
          <View style={styles.underline} />
          <Text style={styles.message}>
            Urakka puuttuu (lomaketta ei käytetty). Kirjaa urakka (alv0): se tallennetaan laskelman urakaksi ja kate lasketaan uudelleen. Urakkaa voi muokata myöhemmin rivikortilla.
          </Text>
          <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
            {lines.map((line) => (
              <AppInput
                key={line.id}
                label={`${line.name} (€, alv0)`}
                value={inputs[line.id] ?? ''}
                onChangeText={(value) => setInputs((prev) => ({ ...prev, [line.id]: value }))}
                keyboardType="decimal-pad"
              />
            ))}
          </ScrollView>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.buttons}>
            <PrimaryButton title="Tallenna ja luo urakkakortti" onPress={handleSubmit} />
            <OutlinedButton title="Peruuta" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 24,
    },
    backdropPressable: { ...StyleSheet.absoluteFillObject },
    dialog: {
      width: '100%' as const,
      maxWidth: 360,
      maxHeight: '90%' as const,
      backgroundColor: colors.secondary,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      elevation: 8,
    },
    title: { fontSize: 20, fontFamily: 'IBMPlexSans_700Bold', color: colors.primary },
    underline: { marginTop: 8, marginBottom: 12, width: 40, height: 3, backgroundColor: colors.accent },
    message: { fontSize: 15, lineHeight: 22, fontFamily: 'IBMPlexSans_400Regular', color: colors.text, marginBottom: 12 },
    list: { flexGrow: 0 },
    error: { color: colors.accent, fontFamily: 'IBMPlexSans_600SemiBold', marginTop: 8 },
    buttons: { gap: 10, marginTop: 12 },
  };
}
