import { useRef, useState } from 'react';
import { View } from 'react-native';

import { ManualContractDialog } from '@/src/components/calculation/ManualContractDialog';
import { OutlinedButton } from '@/src/components/common';
import { useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { exportTarjousPdf, exportUrakkakorttiPdf } from '@/src/core/pdf/exportPdf';
import { pdfExportDeps } from '@/src/core/pdf/pdfExportDeps';

type Busy = 'tarjous' | 'urakkakortti' | null;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** "Luo tarjous" ja "Luo urakkakortti" laskelman tietosivulla (T10). */
export function PdfExportButtons({ calculationId }: { calculationId: string }) {
  const { settings, products, structures, refreshCalculations } = useApp();
  const { showAlert } = useThemedAlert();
  const [busy, setBusy] = useState<Busy>(null);
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

  const handleTarjous = () =>
    run('tarjous', async () => {
      await exportTarjousPdf(calculationId, app, pdfExportDeps);
      await refreshCalculations();
    });

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
      <OutlinedButton
        title={busy === 'tarjous' ? 'Luodaan tarjousta…' : 'Luo tarjous'}
        onPress={handleTarjous}
        disabled={busy !== null}
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
