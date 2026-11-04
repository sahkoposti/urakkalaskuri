import {
  DETAIL_TABS,
  DOKUMENTTI_ACTIONS,
  TARJOUS_SNAPSHOT_KEYS,
  URAKKAKORTTI_SNAPSHOT_KEYS,
  dokumenttiCreateTitle,
  draftCardPriceProblems,
  offerFormFields,
  showCardRowPrices,
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
    expect(TARJOUS_SNAPSHOT_KEYS).toEqual(['ktvPersons', 'offerValidDays', 'businessVatMode']);
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

  it('shows kotitalousvähennys persons only for a private customer', () => {
    expect(offerFormFields(privateCustomer)).toEqual({
      showKtvPersons: true,
      showBusinessVatChoice: false,
    });
    expect(offerFormFields({ name: 'Ilman tyyppiä' }).showKtvPersons).toBe(true);
  });

  it('shows the business VAT choice only for a business customer without reverse VAT', () => {
    expect(offerFormFields(businessCustomer)).toEqual({
      showKtvPersons: false,
      showBusinessVatChoice: true,
    });
    expect(offerFormFields(reverseVatCustomer)).toEqual({
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
      }),
    ).toEqual([
      'Tarjouksen rivillä Seinä on virheellinen hinta. Korjaa hinta ennen tulostusta.',
      'Henkilöiden määrä on kokonaisluku väliltä 1–10.',
      'Tarjous voimassa on kokonaisluku väliltä 1–365.',
    ]);
    expect(
      tarjousBlockingMessages({ offerProblems: [], personsProblem: null, validDaysProblem: null }),
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
});
