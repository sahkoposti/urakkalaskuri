import {
  DETAIL_TABS,
  DOKUMENTTI_ACTIONS,
  TARJOUS_SNAPSHOT_KEYS,
  URAKKAKORTTI_SNAPSHOT_KEYS,
  calculationForUrakkakorttiCreate,
  cleanPdfFormDirty,
  dirtyAfterUrakkakorttiSave,
  dokumenttiCreateTitle,
  draftCardPriceProblems,
  offerFormFields,
  pdfFormSyncReason,
  showCardRowPrices,
  syncPdfFormDraft,
  type PdfFormDirty,
  type PdfFormDraft,
  tarjousBlockingMessages,
  tarjousCreateDisabled,
  urakkakorttiCreateDisabled,
  validDaysHint,
} from '../src/components/pdf/pdfExportFormModel';
import { invalidEmployeeContractWarning } from '../src/core/pdf/urakkakorttiCard';
import { record } from './pdfFixtures';
import type { CustomerInfo } from '../src/core/models/types';

const privateCustomer: CustomerInfo = { name: 'Maija Malli', customerType: 'private' };
const businessCustomer: CustomerInfo = { name: 'Malli Oy', customerType: 'business', reverseVat: false };
const reverseVatCustomer: CustomerInfo = { name: 'Käänteinen Oy', customerType: 'business', reverseVat: true };

describe('pdfExportFormModel', () => {
  it('splits the detail screen into Laskelma and Dokumentit', () => {
    expect(DETAIL_TABS.map((tab) => tab.label)).toEqual(['Laskelma', 'Dokumentit']);
    expect(DOKUMENTTI_ACTIONS.map((action) => action.label)).toEqual(['Luo tarjous', 'Luo urakkakortti']);
  });

  it('keeps tarjous and urakkakortti snapshot keys separate', () => {
    expect(TARJOUS_SNAPSHOT_KEYS).toEqual(['ktvPersons', 'ktvPageIncluded', 'offerValidDays', 'businessVatMode']);
    expect(URAKKAKORTTI_SNAPSHOT_KEYS).toEqual([
      'urakkakorttiMode',
      'urakkakorttiHuomioitavaa',
      'urakkakorttiHidePrices',
      'urakkakorttiRivihinnat',
    ]);
    const overlap = TARJOUS_SNAPSHOT_KEYS.filter((key) =>
      (URAKKAKORTTI_SNAPSHOT_KEYS as readonly string[]).includes(key),
    );
    expect(overlap).toEqual([]);
  });

  it('shows kotitalousvähennys persons only for a private customer while the KTV page is on', () => {
    expect(offerFormFields(privateCustomer)).toEqual({
      showKtvPageChoice: true,
      showKtvPersons: true,
      showBusinessVatChoice: false,
    });
    expect(offerFormFields(privateCustomer, false)).toEqual({
      showKtvPageChoice: true,
      showKtvPersons: false,
      showBusinessVatChoice: false,
    });
    expect(offerFormFields({ name: 'Ilman tyyppiä' }).showKtvPersons).toBe(true);
    expect(offerFormFields({ name: 'Yksityinen käänteinen', customerType: 'private', reverseVat: true })).toEqual({
      showKtvPageChoice: false,
      showKtvPersons: false,
      showBusinessVatChoice: false,
    });
  });

  it('shows the business VAT choice only for a business customer without reverse VAT', () => {
    expect(offerFormFields(businessCustomer)).toEqual({
      showKtvPageChoice: false,
      showKtvPersons: false,
      showBusinessVatChoice: true,
    });
    expect(offerFormFields(reverseVatCustomer)).toEqual({
      showKtvPageChoice: false,
      showKtvPersons: false,
      showBusinessVatChoice: false,
    });
  });

  it('collects the same tarjous blockers as the previous combined form', () => {
    expect(
      tarjousBlockingMessages({
        offerProblems: ['Tarjouksen rivillä Seinä on virheellinen hinta. Korjaa hinta ennen tulostusta.'],
        personsProblem: 'Henkilöiden määrä on kokonaisluku väliltä 1–10.',
        validDaysProblem: 'Tarjous voimassa on kokonaisluku väliltä 1–365.',
        expiryDateProblem: 'Voimassa asti on päivämäärä muodossa p.k.vvvv, 1–365 päivää tarjouksen päiväyksestä. Mennyttä päivää ei voi valita.',
      }),
    ).toEqual([
      'Tarjouksen rivillä Seinä on virheellinen hinta. Korjaa hinta ennen tulostusta.',
      'Henkilöiden määrä on kokonaisluku väliltä 1–10.',
      'Tarjous voimassa on kokonaisluku väliltä 1–365.',
      'Voimassa asti on päivämäärä muodossa p.k.vvvv, 1–365 päivää tarjouksen päiväyksestä. Mennyttä päivää ei voi valita.',
    ]);
    expect(
      tarjousBlockingMessages({
        offerProblems: [],
        personsProblem: null,
        validDaysProblem: null,
        expiryDateProblem: null,
      }),
    ).toEqual([]);
  });

  it('keeps Luo tarjous disabled until company days are loaded and the form is clear', () => {
    const clear = { busy: false, companyValidDaysLoaded: true, blockingMessages: [] as string[] };
    expect(tarjousCreateDisabled(clear)).toBe(false);
    expect(tarjousCreateDisabled({ ...clear, companyValidDaysLoaded: false })).toBe(true);
    expect(tarjousCreateDisabled({ ...clear, busy: true })).toBe(true);
    expect(tarjousCreateDisabled({ ...clear, blockingMessages: ['Este'] })).toBe(true);
  });

  it('keeps Luo urakkakortti disabled while busy or when the card has a problem', () => {
    expect(urakkakorttiCreateDisabled({ busy: false, cardProblems: [] })).toBe(false);
    expect(urakkakorttiCreateDisabled({ busy: true, cardProblems: [] })).toBe(true);
    expect(urakkakorttiCreateDisabled({ busy: false, cardProblems: ['Este'] })).toBe(true);
  });

  it('hides row prices and ignores a draft price error when prices are hidden', () => {
    const lines = [{ id: 'line-1', name: 'Seinä' }];
    expect(showCardRowPrices(false)).toBe(true);
    expect(showCardRowPrices(true)).toBe(false);
    expect(draftCardPriceProblems(lines, { 'line-1': 'abc' }, false)).toEqual([
      invalidEmployeeContractWarning('Seinä'),
    ]);
    expect(draftCardPriceProblems(lines, { 'line-1': '150,50' }, false)).toEqual([]);
    expect(draftCardPriceProblems(lines, { 'line-1': 'abc' }, true)).toEqual([]);
  });

  it('uses the company default in the validity hint and the busy titles', () => {
    expect(validDaysHint(null)).toBe('Esitäyttö yrityksen asetuksesta.');
    expect(validDaysHint(31)).toBe('Esitäyttö yrityksen asetuksesta (31 päivää).');
    expect(dokumenttiCreateTitle('tarjous', false)).toBe('Luo tarjous');
    expect(dokumenttiCreateTitle('tarjous', true)).toBe('Luodaan tarjousta…');
    expect(dokumenttiCreateTitle('urakkakortti', false)).toBe('Luo urakkakortti');
    expect(dokumenttiCreateTitle('urakkakortti', true)).toBe('Luodaan urakkakorttia…');
  });

  it('hides the KTV persons field for a business customer', () => {
    expect(offerFormFields(businessCustomer).showKtvPersons).toBe(false);
    expect(offerFormFields(businessCustomer).showKtvPageChoice).toBe(false);
    expect(offerFormFields(reverseVatCustomer).showKtvPersons).toBe(false);
    expect(offerFormFields(privateCustomer).showKtvPersons).toBe(true);
  });

  it('keeps a dirty persons field when the snapshot changes from the KTV switch', () => {
    const dirty = cleanPdfFormDirty();
    dirty.personsText = true;
    const synced = syncPdfFormDraft(typedDraft, savedAfterKtvSwitch, dirty, 'snapshot');
    expect(synced.draft.personsText).toBe('2');
    expect(synced.draft.ktvPageIncluded).toBe(false);
    expect(synced.draft.huomioText).toBe('Esitäyttö');
    expect(synced.dirty.personsText).toBe(true);
  });

  it('updates a clean field when the snapshot changes from outside', () => {
    const synced = syncPdfFormDraft(typedDraft, savedFromOutside, cleanPdfFormDirty(), 'snapshot');
    expect(synced.draft.personsText).toBe('3');
    expect(synced.draft.huomioText).toBe('Ulkoa');
    expect(synced.draft.rowPriceText).toEqual({ 'line-1': '80,00' });
    expect(synced.dirty).toEqual(cleanPdfFormDirty());
  });

  it('re-syncs every field when the sheet opens again', () => {
    const dirty: PdfFormDirty = {
      personsText: true,
      validDays: true,
      huomioText: true,
      rowPriceText: true,
    };
    const synced = syncPdfFormDraft(typedDraft, savedAfterKtvSwitch, dirty, 'reopen');
    expect(synced.draft).toEqual({ ...savedAfterKtvSwitch, rowPriceText: { ...savedAfterKtvSwitch.rowPriceText } });
    expect(synced.draft.rowPriceText).not.toBe(savedAfterKtvSwitch.rowPriceText);
    expect(synced.dirty).toEqual(cleanPdfFormDirty());
  });

  it('resets drafts when the calculation id changes', () => {
    expect(pdfFormSyncReason(null, 'calc-a')).toBe('calculation');
    expect(pdfFormSyncReason('calc-a', 'calc-a')).toBe('snapshot');
    expect(pdfFormSyncReason('calc-a', 'calc-b')).toBe('calculation');
    const dirty: PdfFormDirty = { personsText: true, validDays: true, huomioText: true, rowPriceText: true };
    const synced = syncPdfFormDraft(typedDraft, savedFromOutside, dirty, pdfFormSyncReason('calc-a', 'calc-b'));
    expect(synced.draft.personsText).toBe('3');
    expect(synced.draft.validDaysText).toBe('7');
    expect(synced.dirty).toEqual(cleanPdfFormDirty());
  });
});

const typedDraft: PdfFormDraft = {
  personsText: '2',
  validDaysText: '14',
  validDateText: '24.10.2026',
  huomioText: 'Telineet mukaan',
  rowPriceText: { 'line-1': '150,50' },
  cardMode: 'alihankkija',
  businessVatMode: 'alv0',
  hidePrices: false,
  ktvPageIncluded: true,
};

const savedAfterKtvSwitch: PdfFormDraft = {
  ...typedDraft,
  personsText: '1',
  huomioText: 'Esitäyttö',
  rowPriceText: { 'line-1': '100,00' },
  ktvPageIncluded: false,
};

const savedFromOutside: PdfFormDraft = {
  ...savedAfterKtvSwitch,
  personsText: '3',
  validDaysText: '7',
  validDateText: '17.10.2026',
  huomioText: 'Ulkoa',
  rowPriceText: { 'line-1': '80,00' },
  ktvPageIncluded: true,
};

describe('urakkakortti create draft', () => {
  const saved = record(
    {},
    {
      formSnapshot: {
        formId: 'f',
        formVersion: 1,
        fields: [],
        urakkakorttiHuomioitavaa: 'Vanha huomio',
        urakkakorttiRivihinnat: { l1: 100 },
      },
    },
  );

  it('uses the typed row price in the card that will be generated', () => {
    const next = calculationForUrakkakorttiCreate(saved, {
      mode: 'alihankkija',
      hidePrices: false,
      dirtyHuomio: true,
      dirtyRowPrices: true,
      typedHuomio: 'Telineet mukaan',
      typedRowPrices: { l1: '250,50' },
    });
    expect(next.formSnapshot?.urakkakorttiRivihinnat).toEqual({ l1: 250.5 });
    expect(next.formSnapshot?.urakkakorttiHuomioitavaa).toBe('Telineet mukaan');
  });

  it('leaves a field that is not dirty unchanged', () => {
    const next = calculationForUrakkakorttiCreate(saved, {
      mode: 'alihankkija',
      hidePrices: false,
      dirtyHuomio: false,
      dirtyRowPrices: false,
      typedHuomio: 'Kirjoitettu mutta ei tallennettu',
      typedRowPrices: { l1: '999,00' },
    });
    expect(next.formSnapshot?.urakkakorttiHuomioitavaa).toBe('Vanha huomio');
    expect(next.formSnapshot?.urakkakorttiRivihinnat).toEqual({ l1: 100 });
  });

  it('does not mark the card fields saved when the save failed', () => {
    const dirty: PdfFormDirty = {
      personsText: true,
      validDays: false,
      huomioText: true,
      rowPriceText: true,
    };
    expect(dirtyAfterUrakkakorttiSave(dirty, false)).toEqual(dirty);
    expect(dirtyAfterUrakkakorttiSave(dirty, false)).not.toBe(dirty);
    const cleared = dirtyAfterUrakkakorttiSave(dirty, true);
    expect(cleared.huomioText).toBe(false);
    expect(cleared.rowPriceText).toBe(false);
    expect(cleared.personsText).toBe(true);
  });
});
