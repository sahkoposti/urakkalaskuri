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
import { calculationWithKtvPageIncluded, readKtvPageIncluded } from '@/src/core/pdf/ktvPageIncluded';
import { offerDocumentProblems } from '@/src/core/pdf/offerDocument';
import {
  daysTextForExpiryDate,
  expiryDateTextForDays,
  formatOfferExpiryDate,
  offerExpiryDateProblem,
  parseOfferValidDateInput,
} from '@/src/core/pdf/offerExpiryDate';
import {
  calculationWithOfferValidDays,
  companyOfferValidDays,
  OFFER_VALID_DAYS_INVALID_MESSAGE,
  offerValidDaysFieldText,
  offerValidDaysForSave,
  parseOfferValidDaysInput,
} from '@/src/core/pdf/offerValidDays';
import { validUntil } from '@/src/core/pdf/validUntil';
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
  sheetDraftAfterClose,
  tarjousBlockingMessages,
  tarjousCreateDisabled,
  urakkakorttiCreateDisabled,
  validDaysHint,
} from './pdfExportFormModel';

type Busy = 'tarjous' | 'urakkakortti' | null;

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Tarjouksen päiväys lomakkeella: tämä kalenteripäivä, sama sääntö kuin tulosteen Voimassa. */
function offerDateFromNow(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Tarjouksen ja urakkakortin lomaketila. Sama tallennus, numerointi ja jako
 * kuin aiemmassa näkymässä. KTV-kytkin päällä pitää tarjouksen PDF:n ennallaan.
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
  const [validDateText, setValidDateText] = useState(() =>
    expiryDateTextForDays(offerValidDaysFieldText(record.formSnapshot, null), offerDateFromNow(), ''),
  );
  const [ktvPageIncluded, setKtvPageIncluded] = useState(() => readKtvPageIncluded(record.formSnapshot));
  const validDaysDirty = useRef(false);
  const offerDateRef = useRef<Date | null>(null);
  if (offerDateRef.current == null) offerDateRef.current = offerDateFromNow();
  const offerDate = offerDateRef.current;
  const companyDaysRef = useRef<number | null>(null);
  companyDaysRef.current = companyValidDays;
  const overrideTextRef = useRef(overrideText);
  overrideTextRef.current = overrideText;
  const customer = customerFromRecord(record);
  const fields = offerFormFields(customer, ktvPageIncluded);
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
  const expiryProblem = offerExpiryDateProblem(validDateText, offerDate, validDaysText);
  const blockingMessages = tarjousBlockingMessages({
    offerProblems,
    personsProblem,
    validDaysProblem,
    expiryDateProblem: expiryProblem,
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
    setKtvPageIncluded(readKtvPageIncluded(record.formSnapshot));
    validDaysDirty.current = false;
    const nextDays = offerValidDaysFieldText(record.formSnapshot, companyDaysRef.current);
    setValidDaysText(nextDays);
    setValidDateText(expiryDateTextForDays(nextDays, offerDateRef.current ?? offerDateFromNow(), ''));
  }, [record.id, record.formSnapshot, record.customer]);

  useEffect(() => {
    let cancelled = false;
    void db.getOfferCompanySettings().then((offerSettings) => {
      if (cancelled) return;
      const days = companyOfferValidDays(offerSettings.offerValidDays);
      setCompanyValidDays(days);
      if (!validDaysDirty.current && !Object.prototype.hasOwnProperty.call(record.formSnapshot ?? {}, 'offerValidDays')) {
        const text = String(days);
        setValidDaysText(text);
        setValidDateText(formatOfferExpiryDate(validUntil(offerDateRef.current ?? offerDateFromNow(), days)));
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

  const persistKtvPageIncluded = async (included: boolean) => {
    await persistRecord(calculationWithKtvPageIncluded(record, included));
  };

  const commitValidDays = (daysText: string) => {
    const days = offerValidDaysForSave({
      snapshot: record.formSnapshot,
      fieldText: daysText,
      companyDefault: companyValidDays,
      touched: validDaysDirty.current,
    });
    if (typeof days !== 'number') return;
    setValidDaysText(String(days));
    setValidDateText(formatOfferExpiryDate(validUntil(offerDate, days)));
    validDaysDirty.current = false;
    void persistValidDays(days).catch(reportSaveError);
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
      if (fields.showKtvPageChoice) await persistKtvPageIncluded(ktvPageIncluded);
      if (fields.showKtvPersons && parsedPersons !== 'invalid') await persistPersons(parsedPersons);
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
    keepSheetDraft: () => {
      const kept = sheetDraftAfterClose({
        personsText,
        validDaysText,
        validDateText,
        huomioText,
        rowPriceText: overrideTextRef.current,
      });
      setPersonsText(kept.personsText);
      setValidDaysText(kept.validDaysText);
      setValidDateText(kept.validDateText);
      setHuomioText(kept.huomioText);
      setOverrideText(kept.rowPriceText);
      overrideTextRef.current = kept.rowPriceText;
    },
    offer: {
      showKtvPageChoice: fields.showKtvPageChoice,
      ktvPageIncluded,
      onKtvPageIncludedChange: (included: boolean) => {
        setKtvPageIncluded(included);
        void persistKtvPageIncluded(included).catch(reportSaveError);
      },
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
        setValidDateText(expiryDateTextForDays(value, offerDate, validDateText));
      },
      onValidDaysBlur: () => {
        commitValidDays(validDaysText);
      },
      validDaysHint: validDaysHint(companyValidDays),
      validDaysProblem,
      validDateText,
      onValidDateChange: (value: string) => {
        validDaysDirty.current = true;
        setValidDateText(value);
        setValidDaysText(daysTextForExpiryDate(value, offerDate, validDaysText));
      },
      onValidDateBlur: () => {
        const days = parseOfferValidDateInput(validDateText, offerDate);
        if (typeof days !== 'number') return;
        commitValidDays(String(days));
      },
      expiryDateProblem: expiryProblem,
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
