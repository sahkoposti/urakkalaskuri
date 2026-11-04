import {
  DETAIL_TABS,
  DOKUMENTTI_ACTIONS,
  TARJOUS_SNAPSHOT_KEYS,
  URAKKAKORTTI_SNAPSHOT_KEYS,
  dokumenttiCreateTitle,
  draftCardPriceProblems,
  offerFormFields,
  sheetDraftAfterClose,
  showCardRowPrices,
  type SheetDraftText,
  tarjousBlockingMessages,
  tarjousCreateDisabled,
  urakkakorttiCreateDisabled,
  validDaysHint,
} from '../src/components/pdf/pdfExportFormModel';
import { invalidEmployeeContractWarning } from '../src/core/pdf/urakkakorttiCard';
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
        expiryDateProblem: 'Voimassa asti on päivämäärä muodossa pp.kk.vvvv, 1–365 päivää tarjouksen päiväyksestä. Mennyttä päivää ei voi valita.',
      }),
    ).toEqual([
      'Tarjouksen rivillä Seinä on virheellinen hinta. Korjaa hinta ennen tulostusta.',
      'Henkilöiden määrä on kokonaisluku väliltä 1–10.',
      'Tarjous voimassa on kokonaisluku väliltä 1–365.',
      'Voimassa asti on päivämäärä muodossa pp.kk.vvvv, 1–365 päivää tarjouksen päiväyksestä. Mennyttä päivää ei voi valita.',
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

  it('keeps typed sheet text when the sheet closes before blur', () => {
    const committed: SheetDraftText = {
      personsText: '1',
      validDaysText: '31',
      validDateText: '10.11.2026',
      huomioText: 'Esitäyttö',
      rowPriceText: { 'line-1': '100,00' },
    };
    const draft: SheetDraftText = {
      personsText: '2',
      validDaysText: '14',
      validDateText: '24.10.2026',
      huomioText: 'Telineet mukaan',
      rowPriceText: { 'line-1': '150,50' },
    };
    const kept = sheetDraftAfterClose(draft);
    expect(kept).toEqual(draft);
    expect(kept).not.toEqual(committed);
    expect(kept.rowPriceText).not.toBe(draft.rowPriceText);
    kept.rowPriceText['line-1'] = '0';
    expect(draft.rowPriceText['line-1']).toBe('150,50');
  });
});
