import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { ManualContractDialog } from '@/src/components/calculation/ManualContractDialog';
import { OutlinedButton } from '@/src/components/common';
import { useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { CalculationRecord } from '@/src/core/models/types';
import { exportTarjousPdf, exportUrakkakorttiPdf } from '@/src/core/pdf/exportPdf';
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
  const offerProblems = offerDocumentProblems(record);
  // Ref estää tuplanapautuksen ennen kuin tila ehtii päivittyä (DB-lukko on toinen varmistus).
  const busyRef = useRef(false);
  const [manualLines, setManualLines] = useState<{ id: string; name: string }[] | null>(null);
  const app = { settings, products, structures };

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
    if (offerProblems.length > 0) {
      showAlert('Tarjousta ei voi tulostaa', offerProblems.join('\n'));
      return;
    }
    return run('tarjous', async () => {
      await exportTarjousPdf(calculationId, app, pdfExportDeps);
      await refreshCalculations();
    });
  };

  const handleUrakkakortti = (manualValues?: Record<string, number>) =>
    run('urakkakortti', async () => {
      const result = await exportUrakkakorttiPdf(calculationId, app, pdfExportDeps, manualValues);
      if (result.status === 'needsManualContract') {
        setManualLines(result.lines);
        return;
      }
      if (manualValues) await refreshCalculations();
    });

  return (
    <View>
      {offerProblems.map((problem, index) => (
        <Text key={`${index}:${problem}`} style={styles.warning} accessibilityRole="alert">
          {problem}
        </Text>
      ))}
      <OutlinedButton
        title={busy === 'tarjous' ? 'Luodaan tarjousta…' : 'Luo tarjous'}
        onPress={handleTarjous}
        disabled={busy !== null || offerProblems.length > 0}
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
