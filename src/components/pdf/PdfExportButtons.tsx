import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { ManualContractDialog } from '@/src/components/calculation/ManualContractDialog';
import { ChoiceToggle } from '@/src/components/ChoiceToggle';
import { AppInput, OutlinedButton } from '@/src/components/common';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import type { CalculationRecord } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { exportTarjousPdf, exportUrakkakorttiPdf } from '@/src/core/pdf/exportPdf';
import {
  calculationWithKtvPersons,
  KTV_PERSONS_INVALID_MESSAGE,
  ktvPersonsFieldText,
  parseKtvPersonsInput,
} from '@/src/core/pdf/ktvPersons';
import {
  calculationWithBusinessVatMode,
  calculationWithHuomioitavaa,
  calculationWithUrakkakorttiHidePrices,
  calculationWithUrakkakorttiMode,
  calculationWithUrakkakorttiRivihinnat,
  cardPriceFieldTexts,
  huomioitavaaFieldText,
  invalidEmployeeContractWarning,
  parseCardPriceInput,
  readUrakkakorttiHidePrices,
  readUrakkakorttiMode,
  urakkakorttiContractProblems,
  urakkakorttiRivihinnatFromFieldTexts,
  type UrakkakorttiMode,
} from '@/src/core/pdf/urakkakorttiCard';
import { readBusinessVatMode, type BusinessVatMode } from '@/src/core/utils/priceDisplay';
import { offerDocumentProblems } from '@/src/core/pdf/offerDocument';
import {
  calculationWithOfferValidDays,
  companyOfferValidDays,
  OFFER_VALID_DAYS_INVALID_MESSAGE,
  offerValidDaysFieldText,
  offerValidDaysForSave,
  parseOfferValidDaysInput,
} from '@/src/core/pdf/offerValidDays';
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
  const [businessVatMode, setBusinessVatMode] = useState<BusinessVatMode>(() =>
    readBusinessVatMode(record.formSnapshot),
  );
  const [hidePrices, setHidePrices] = useState(() => readUrakkakorttiHidePrices(record.formSnapshot));
  const [overrideText, setOverrideText] = useState(() => cardPriceFieldTexts(record));
  const [companyValidDays, setCompanyValidDays] = useState<number | null>(null);
  const [validDaysText, setValidDaysText] = useState(() => offerValidDaysFieldText(record.formSnapshot, null));
  const validDaysDirty = useRef(false);
  const companyDaysRef = useRef<number | null>(null);
  companyDaysRef.current = companyValidDays;
  const overrideTextRef = useRef(overrideText);
  overrideTextRef.current = overrideText;
  const customer = customerFromRecord(record);
  const showBusinessVatChoice = customer.customerType === 'business' && !customer.reverseVat;
  const offerProblems = offerDocumentProblems(record);
  const cardLines = ensureStructureLines(record);
  const draftOverrideProblems = hidePrices
    ? []
    : cardLines.flatMap((line) =>
        parseCardPriceInput(overrideText[line.id] ?? '') === 'invalid'
          ? [invalidEmployeeContractWarning(line.name)]
          : [],
      );
  const cardProblems = [
    ...urakkakorttiContractProblems(record, cardMode, hidePrices),
    ...draftOverrideProblems,
  ];
  const parsedPersons = parseKtvPersonsInput(personsText);
  const personsProblem = parsedPersons === 'invalid' ? KTV_PERSONS_INVALID_MESSAGE : null;
  const parsedValidDays = parseOfferValidDaysInput(validDaysText);
  const validDaysProblem = parsedValidDays === 'invalid' ? OFFER_VALID_DAYS_INVALID_MESSAGE : null;
  // Ref estää tuplanapautuksen ennen kuin tila ehtii päivittyä (DB-lukko on toinen varmistus).
  const busyRef = useRef(false);
  const [manualLines, setManualLines] = useState<{ id: string; name: string }[] | null>(null);
  const app = { settings, products, structures };

  useEffect(() => {
    setPersonsText(ktvPersonsFieldText(record.formSnapshot));
    setCardMode(readUrakkakorttiMode(record.formSnapshot));
    setHuomioText(huomioitavaaFieldText(record));
    setBusinessVatMode(readBusinessVatMode(record.formSnapshot));
    setHidePrices(readUrakkakorttiHidePrices(record.formSnapshot));
    setOverrideText(cardPriceFieldTexts(record));
    validDaysDirty.current = false;
    setValidDaysText(offerValidDaysFieldText(record.formSnapshot, companyDaysRef.current));
  }, [record.id, record.formSnapshot, record.customer]);

  useEffect(() => {
    let cancelled = false;
    void db.getOfferCompanySettings().then((settings) => {
      if (cancelled) return;
      const days = companyOfferValidDays(settings.offerValidDays);
      setCompanyValidDays(days);
      if (!validDaysDirty.current && !Object.prototype.hasOwnProperty.call(record.formSnapshot ?? {}, 'offerValidDays')) {
        setValidDaysText(String(days));
      }
    }).catch((error) => {
      console.error(error);
    });
    return () => {
      cancelled = true;
    };
  }, [record.id, record.formSnapshot]);

  const persistRecord = async (next: CalculationRecord) => {
    if (next === record) return;
    await db.saveCalculation(next);
    await refreshCalculations();
  };

  const persistPersons = async (persons: number) => {
    await persistRecord(calculationWithKtvPersons(record, persons));
  };

  const persistValidDays = async (days: number) => {
    if (companyValidDays == null) return;
    await persistRecord(calculationWithOfferValidDays(record, days, companyValidDays));
  };

  const persistBusinessVatMode = async (mode: BusinessVatMode) => {
    await persistRecord(calculationWithBusinessVatMode(record, mode));
  };

  const persistOverrides = async (texts: Record<string, string>) => {
    const next = urakkakorttiRivihinnatFromFieldTexts(record, texts, cardMode);
    await persistRecord(calculationWithUrakkakorttiRivihinnat(record, next));
  };

  const persistCard = async (mode: UrakkakorttiMode, huomio: string, hide: boolean) => {
    const withMode = calculationWithUrakkakorttiMode(record, mode);
    const withNote = calculationWithHuomioitavaa(withMode, huomio);
    const withHide = calculationWithUrakkakorttiHidePrices(withNote, hide);
    await persistRecord(withHide);
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
    const blocked = [...offerProblems, ...(personsProblem ? [personsProblem] : []), ...(validDaysProblem ? [validDaysProblem] : [])];
    if (blocked.length > 0) {
      showAlert('Tarjousta ei voi tulostaa', blocked.join('\n'));
      return;
    }
    if (companyValidDays == null) return;
    return run('tarjous', async () => {
      if (parsedPersons !== 'invalid') await persistPersons(parsedPersons);
      const days = offerValidDaysForSave({
        snapshot: record.formSnapshot,
        fieldText: validDaysText,
        companyDefault: companyValidDays,
        touched: validDaysDirty.current,
      });
      if (typeof days === 'number') await persistValidDays(days);
      await exportTarjousPdf(calculationId, app, pdfExportDeps);
      await refreshCalculations();
    });
  };

  const handleUrakkakortti = (manualValues?: Record<string, number>) => {
    if (cardProblems.length > 0) {
      showAlert('Urakkakorttia ei voi tulostaa', cardProblems.join('\n'));
      return;
    }
    return run('urakkakortti', async () => {
      await persistCard(cardMode, huomioText, hidePrices);
      const result = await exportUrakkakorttiPdf(calculationId, app, pdfExportDeps, manualValues);
      if (result.status === 'needsManualContract') {
        setManualLines(result.lines);
        return;
      }
      if (manualValues) await refreshCalculations();
    });
  };

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
        kind="integer"
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
      <AppInput
        label="Tarjous voimassa (päivää)"
        value={validDaysText}
        onChangeText={(value) => {
          validDaysDirty.current = true;
          setValidDaysText(value);
        }}
        onBlur={() => {
          const days = offerValidDaysForSave({
            snapshot: record.formSnapshot,
            fieldText: validDaysText,
            companyDefault: companyValidDays,
            touched: validDaysDirty.current,
          });
          if (typeof days !== 'number') return;
          setValidDaysText(String(days));
          validDaysDirty.current = false;
          void persistValidDays(days).catch((error) => {
            console.error(error);
            showAlert('Tallennus epäonnistui', errorMessage(error));
          });
        }}
        kind="integer"
        compact
      />
      <Text style={styles.hint}>
        {companyValidDays == null
          ? 'Esitäyttö yrityksen asetuksesta.'
          : `Esitäyttö yrityksen asetuksesta (${companyValidDays} päivää).`}
      </Text>
      {validDaysProblem ? (
        <Text style={styles.warning} accessibilityRole="alert">
          {validDaysProblem}
        </Text>
      ) : null}
      {showBusinessVatChoice ? (
        <ChoiceToggle
          label="Hintojen ALV"
          value={businessVatMode}
          options={[
            { value: 'alv0', label: 'ALV 0' },
            { value: 'sis', label: 'Sis. ALV' },
          ]}
          onChange={(mode) => {
            setBusinessVatMode(mode);
            void persistBusinessVatMode(mode).catch((error) => {
              console.error(error);
              showAlert('Tallennus epäonnistui', errorMessage(error));
            });
          }}
        />
      ) : null}
      <OutlinedButton
        title={busy === 'tarjous' ? 'Luodaan tarjousta…' : 'Luo tarjous'}
        onPress={handleTarjous}
        disabled={
          busy !== null ||
          companyValidDays == null ||
          offerProblems.length > 0 ||
          personsProblem !== null ||
          validDaysProblem !== null
        }
      />
      <AppPicker
        label="Urakkakortti"
        selectedValue={cardMode}
        onValueChange={(value) => {
          const mode: UrakkakorttiMode = value === 'tyontekija' ? 'tyontekija' : 'alihankkija';
          const texts = cardPriceFieldTexts(record, mode);
          setCardMode(mode);
          setOverrideText(texts);
          overrideTextRef.current = texts;
          void persistCard(mode, huomioText, hidePrices).catch((error) => {
            console.error(error);
            showAlert('Tallennus epäonnistui', errorMessage(error));
          });
        }}
        items={[
          { value: 'alihankkija', label: 'Alihankkija' },
          { value: 'tyontekija', label: 'Työntekijä' },
        ]}
      />
      <ChoiceToggle
        label="Urakkahinnat"
        value={hidePrices}
        options={[
          { value: false, label: 'Näytä' },
          { value: true, label: 'Älä näytä urakkahintoja' },
        ]}
        onChange={(hide) => {
          setHidePrices(hide);
          void persistCard(cardMode, huomioText, hide).catch((error) => {
            console.error(error);
            showAlert('Tallennus epäonnistui', errorMessage(error));
          });
        }}
      />
      {hidePrices
        ? null
        : cardLines.map((line) => (
            <AppInput
              key={line.id}
              label={`Urakkahinta: ${line.name}`}
              value={overrideText[line.id] ?? ''}
              onChangeText={(value) =>
                setOverrideText((current) => {
                  const next = { ...current, [line.id]: value };
                  overrideTextRef.current = next;
                  return next;
                })
              }
              onBlur={() => {
                void persistOverrides(overrideTextRef.current).catch((error) => {
                  console.error(error);
                  showAlert('Tallennus epäonnistui', errorMessage(error));
                });
              }}
              kind="decimal"
              compact
            />
          ))}
      <AppInput
        label="Huomioitavaa"
        value={huomioText}
        onChangeText={setHuomioText}
        kind="sentence"
        onBlur={() => {
          void persistCard(cardMode, huomioText, hidePrices).catch((error) => {
            console.error(error);
            showAlert('Tallennus epäonnistui', errorMessage(error));
          });
        }}
        multiline
        placeholder="Esitäyttö asiakkaan lisätiedoista"
      />
      {cardProblems.map((problem, index) => (
        <Text key={`${index}:${problem}`} style={styles.warning} accessibilityRole="alert">
          {problem}
        </Text>
      ))}
      <OutlinedButton
        title={busy === 'urakkakortti' ? 'Luodaan urakkakorttia…' : 'Luo urakkakortti'}
        onPress={() => handleUrakkakortti()}
        disabled={busy !== null || cardProblems.length > 0}
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
    hint: {
      marginBottom: 8,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 18,
      color: colors.text,
    },
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
