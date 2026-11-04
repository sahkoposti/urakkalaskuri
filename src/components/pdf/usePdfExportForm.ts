import { useEffect, useRef, useState } from 'react';

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
import {
  calculationWithBusinessVatMode,
  calculationWithHuomioitavaa,
  calculationWithUrakkakorttiHidePrices,
  calculationWithUrakkakorttiMode,
  calculationWithUrakkakorttiRivihinnat,
  cardPriceFieldTexts,
  huomioitavaaFieldText,
  readUrakkakorttiHidePrices,
  readUrakkakorttiMode,
  urakkakorttiContractProblems,
  urakkakorttiRivihinnatFromFieldTexts,
  type UrakkakorttiMode,
} from '@/src/core/pdf/urakkakorttiCard';
import { readBusinessVatMode, type BusinessVatMode } from '@/src/core/utils/priceDisplay';

import {
  dokumenttiCreateTitle,
  draftCardPriceProblems,
  offerFormFields,
  tarjousBlockingMessages,
  tarjousCreateDisabled,
  urakkakorttiCreateDisabled,
  validDaysHint,
} from './pdfExportFormModel';

type Busy = 'tarjous' | 'urakkakortti' | null;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Tarjouksen ja urakkakortin lomaketila. Sama tallennus, numerointi ja jako
 * kuin aiemmassa yhteisessä painikenäkymässä. PDF-tavut eivät muutu.
 */
export function usePdfExportForm(calculationId: string, record: CalculationRecord) {
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
  const fields = offerFormFields(customer);
  const offerProblems = offerDocumentProblems(record);
  const cardLines = ensureStructureLines(record);
  const draftOverrideProblems = draftCardPriceProblems(cardLines, overrideText, hidePrices);
  const cardProblems = [
    ...urakkakorttiContractProblems(record, cardMode, hidePrices),
    ...draftOverrideProblems,
  ];
  const parsedPersons = parseKtvPersonsInput(personsText);
  const personsProblem =
    fields.showKtvPersons && parsedPersons === 'invalid' ? KTV_PERSONS_INVALID_MESSAGE : null;
  const parsedValidDays = parseOfferValidDaysInput(validDaysText);
  const validDaysProblem = parsedValidDays === 'invalid' ? OFFER_VALID_DAYS_INVALID_MESSAGE : null;
  const blockingMessages = tarjousBlockingMessages({
    offerProblems,
    personsProblem,
    validDaysProblem,
  });
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
    void db.getOfferCompanySettings().then((offerSettings) => {
      if (cancelled) return;
      const days = companyOfferValidDays(offerSettings.offerValidDays);
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

  const reportSaveError = (error: unknown) => {
    console.error(error);
    showAlert('Tallennus epäonnistui', errorMessage(error));
  };

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
    if (blockingMessages.length > 0) {
      showAlert('Tarjousta ei voi tulostaa', blockingMessages.join('\n'));
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

  const anyBusy = busy !== null;

  return {
    manualLines,
    cancelManual: () => setManualLines(null),
    submitManual: (values: Record<string, number>) => {
      setManualLines(null);
      void handleUrakkakortti(values);
    },
    offer: {
      showKtvPersons: fields.showKtvPersons,
      personsText,
      onPersonsChange: setPersonsText,
      onPersonsBlur: () => {
        if (parsedPersons === 'invalid') return;
        void persistPersons(parsedPersons).catch(reportSaveError);
      },
      personsProblem,
      validDaysText,
      onValidDaysChange: (value: string) => {
        validDaysDirty.current = true;
        setValidDaysText(value);
      },
      onValidDaysBlur: () => {
        const days = offerValidDaysForSave({
          snapshot: record.formSnapshot,
          fieldText: validDaysText,
          companyDefault: companyValidDays,
          touched: validDaysDirty.current,
        });
        if (typeof days !== 'number') return;
        setValidDaysText(String(days));
        validDaysDirty.current = false;
        void persistValidDays(days).catch(reportSaveError);
      },
      validDaysHint: validDaysHint(companyValidDays),
      validDaysProblem,
      showBusinessVatChoice: fields.showBusinessVatChoice,
      businessVatMode,
      onBusinessVatModeChange: (mode: BusinessVatMode) => {
        setBusinessVatMode(mode);
        void persistBusinessVatMode(mode).catch(reportSaveError);
      },
      offerProblems,
      createTitle: dokumenttiCreateTitle('tarjous', busy === 'tarjous'),
      createDisabled: tarjousCreateDisabled({
        busy: anyBusy,
        companyValidDaysLoaded: companyValidDays != null,
        blockingMessages,
      }),
      onCreate: handleTarjous,
    },
    card: {
      cardMode,
      onCardModeChange: (value: string) => {
        const mode: UrakkakorttiMode = value === 'tyontekija' ? 'tyontekija' : 'alihankkija';
        const texts = cardPriceFieldTexts(record, mode);
        setCardMode(mode);
        setOverrideText(texts);
        overrideTextRef.current = texts;
        void persistCard(mode, huomioText, hidePrices).catch(reportSaveError);
      },
      hidePrices,
      onHidePricesChange: (hide: boolean) => {
        setHidePrices(hide);
        void persistCard(cardMode, huomioText, hide).catch(reportSaveError);
      },
      lines: cardLines.map((line) => ({
        id: line.id,
        name: line.name,
        priceText: overrideText[line.id] ?? '',
      })),
      onRowPriceChange: (lineId: string, value: string) => {
        setOverrideText((current) => {
          const next = { ...current, [lineId]: value };
          overrideTextRef.current = next;
          return next;
        });
      },
      onRowPricesBlur: () => {
        void persistOverrides(overrideTextRef.current).catch(reportSaveError);
      },
      huomioText,
      onHuomioChange: setHuomioText,
      onHuomioBlur: () => {
        void persistCard(cardMode, huomioText, hidePrices).catch(reportSaveError);
      },
      cardProblems,
      createTitle: dokumenttiCreateTitle('urakkakortti', busy === 'urakkakortti'),
      createDisabled: urakkakorttiCreateDisabled({ busy: anyBusy, cardProblems }),
      onCreate: () => handleUrakkakortti(),
    },
  };
}

export type PdfExportFormState = ReturnType<typeof usePdfExportForm>;
