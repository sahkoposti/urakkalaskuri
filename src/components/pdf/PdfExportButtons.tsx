import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { ManualContractDialog } from '@/src/components/calculation/ManualContractDialog';
import { AppInput, OutlinedButton } from '@/src/components/common';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { CalculationRecord } from '@/src/core/models/types';
import { exportTarjousPdf, exportUrakkakorttiPdf } from '@/src/core/pdf/exportPdf';
import {
  calculationWithKtvPersons,
  KTV_PERSONS_INVALID_MESSAGE,
  ktvPersonsFieldText,
  parseKtvPersonsInput,
} from '@/src/core/pdf/ktvPersons';
import {
  calculationWithHuomioitavaa,
  calculationWithUrakkakorttiMode,
  huomioitavaaFieldText,
  readUrakkakorttiMode,
  type UrakkakorttiMode,
} from '@/src/core/pdf/urakkakorttiCard';
import { offerDocumentProblems } from '@/src/core/pdf/offerDocument';
import { pdfExportDeps } from '@/src/core/pdf/pdfExportDeps';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type Busy = 'tarjous' | 'urakkakortti' | null;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** "Luo tarjous" ja "Luo urakkakortti" laskelman tietosivulla (T10). */
export function PdfExportButtons({
  calculationId,
  record,
}: {
  calculationId: string;
  record: CalculationRecord;
}) {
  const styles = useThemedStyles(createStyles);
  const { settings, products, structures, refreshCalculations } = useApp();
  const { showAlert } = useThemedAlert();
  const [busy, setBusy] = useState<Busy>(null);
  const [personsText, setPersonsText] = useState(() => ktvPersonsFieldText(record.formSnapshot));
  const [cardMode, setCardMode] = useState<UrakkakorttiMode>(() => readUrakkakorttiMode(record.formSnapshot));
  const [huomioText, setHuomioText] = useState(() => huomioitavaaFieldText(record));
  const offerProblems = offerDocumentProblems(record);
  const parsedPersons = parseKtvPersonsInput(personsText);
  const personsProblem = parsedPersons === 'invalid' ? KTV_PERSONS_INVALID_MESSAGE : null;
  // Ref estää tuplanapautuksen ennen kuin tila ehtii päivittyä (DB-lukko on toinen varmistus).
  const busyRef = useRef(false);
  const [manualLines, setManualLines] = useState<{ id: string; name: string }[] | null>(null);
  const app = { settings, products, structures };

  useEffect(() => {
    setPersonsText(ktvPersonsFieldText(record.formSnapshot));
    setCardMode(readUrakkakorttiMode(record.formSnapshot));
    setHuomioText(huomioitavaaFieldText(record));
  }, [record.id, record.formSnapshot, record.customer]);

  const persistRecord = async (next: CalculationRecord) => {
    if (next === record) return;
    await db.saveCalculation(next);
    await refreshCalculations();
  };

  const persistPersons = async (persons: number) => {
    await persistRecord(calculationWithKtvPersons(record, persons));
  };

  const persistCard = async (mode: UrakkakorttiMode, huomio: string) => {
    const withMode = calculationWithUrakkakorttiMode(record, mode);
    const withNote = calculationWithHuomioitavaa(withMode, huomio);
    await persistRecord(withNote);
  };

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    try {
      await task();
    } catch (error) {
      console.error(error);
      showAlert(
        kind === 'tarjous' ? 'Tarjouksen luonti epäonnistui' : 'Urakkakortin luonti epäonnistui',
        errorMessage(error),
      );
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  };

  const handleTarjous = () => {
    const blocked = [...offerProblems, ...(personsProblem ? [personsProblem] : [])];
    if (blocked.length > 0) {
      showAlert('Tarjousta ei voi tulostaa', blocked.join('\n'));
      return;
    }
    return run('tarjous', async () => {
      if (parsedPersons !== 'invalid') await persistPersons(parsedPersons);
      await exportTarjousPdf(calculationId, app, pdfExportDeps);
      await refreshCalculations();
    });
  };

  const handleUrakkakortti = (manualValues?: Record<string, number>) =>
    run('urakkakortti', async () => {
      await persistCard(cardMode, huomioText);
      const result = await exportUrakkakorttiPdf(calculationId, app, pdfExportDeps, manualValues);
      if (result.status === 'needsManualContract') {
        setManualLines(result.lines);
        return;
      }
      if (manualValues) await refreshCalculations();
    });

  return (
    <View>
      <AppInput
        label="Henkilöiden määrä (kotitalousvähennys)"
        value={personsText}
        onChangeText={setPersonsText}
        onBlur={() => {
          if (parsedPersons === 'invalid') return;
          void persistPersons(parsedPersons).catch((error) => {
            console.error(error);
            showAlert('Tallennus epäonnistui', errorMessage(error));
          });
        }}
        keyboardType="numeric"
        compact
      />
      {offerProblems.map((problem, index) => (
        <Text key={`${index}:${problem}`} style={styles.warning} accessibilityRole="alert">
          {problem}
        </Text>
      ))}
      {personsProblem ? (
        <Text style={styles.warning} accessibilityRole="alert">
          {personsProblem}
        </Text>
      ) : null}
      <OutlinedButton
        title={busy === 'tarjous' ? 'Luodaan tarjousta…' : 'Luo tarjous'}
        onPress={handleTarjous}
        disabled={busy !== null || offerProblems.length > 0 || personsProblem !== null}
      />
      <AppPicker
        label="Urakkakortti"
        selectedValue={cardMode}
        onValueChange={(value) => {
          const mode: UrakkakorttiMode = value === 'tyontekija' ? 'tyontekija' : 'alihankkija';
          setCardMode(mode);
          void persistCard(mode, huomioText).catch((error) => {
            console.error(error);
            showAlert('Tallennus epäonnistui', errorMessage(error));
          });
        }}
        items={[
          { value: 'alihankkija', label: 'Alihankkija' },
          { value: 'tyontekija', label: 'Työntekijä' },
        ]}
      />
      <AppInput
        label="Huomioitavaa"
        value={huomioText}
        onChangeText={setHuomioText}
        onBlur={() => {
          void persistCard(cardMode, huomioText).catch((error) => {
            console.error(error);
            showAlert('Tallennus epäonnistui', errorMessage(error));
          });
        }}
        multiline
        placeholder="Esitäyttö asiakkaan lisätiedoista"
      />
      <OutlinedButton
        title={busy === 'urakkakortti' ? 'Luodaan urakkakorttia…' : 'Luo urakkakortti'}
        onPress={() => handleUrakkakortti()}
        disabled={busy !== null}
      />
      <ManualContractDialog
        visible={manualLines !== null}
        lines={manualLines ?? []}
        onCancel={() => setManualLines(null)}
        onSubmit={(values) => {
          setManualLines(null);
          void handleUrakkakortti(values);
        }}
      />
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    warning: {
      marginBottom: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      backgroundColor: colors.surface,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
  };
}
