export interface AppSettings {
  vatPercent: number;
  /** Uuden tuoterakenteen kate-%-oletus (liukuvan katteen alaraja). */
  defaultMarginPercent: number;
  /** Uuden tuoterakenteen oletus: myyntihinta (alv0), jossa kate on marginLowPercent. */
  marginLowAmount: number;
  marginLowPercent: number;
  /** Uuden tuoterakenteen oletus: myyntihinta (alv0), jossa kate on marginHighPercent. */
  marginHighAmount: number;
  marginHighPercent: number;
  /** Uuden tuoterakenteen myyntipalkkio-%. */
  defaultCommissionPercent: number;
  defaultHourlyRate: number;
  /** Uuden tuoterakenteen oletus. Kaavat käyttävät rakenteen `crewSize`-arvoa. */
  defaultCrewSize: number;
  workdayHours: number;
  /** Kerroin yhteenvedon työn kestolle (säävaraus). Ei vaikuta hinnoitteluun. */
  weatherReserveFactor: number;
  theme: ThemeSettings;
}

export type CustomerType = 'private' | 'business';

export interface ThemeSettings {
  accentColor: string;
  primaryColor: string;
  textColor: string;
  surfaceColor: string;
  backgroundImageUri: string;
  backgroundOpacity: number;
}

export const defaultThemeSettings: ThemeSettings = {
  accentColor: '#C90000',
  primaryColor: '#000000',
  textColor: '#3C3C3C',
  surfaceColor: '#F9FAFA',
  backgroundImageUri: '',
  backgroundOpacity: 100,
};

export const defaultSettings: AppSettings = {
  vatPercent: 25.5,
  defaultMarginPercent: 35,
  marginLowAmount: 2000,
  marginLowPercent: 45,
  marginHighAmount: 10000,
  marginHighPercent: 30,
  defaultCommissionPercent: 7,
  defaultHourlyRate: 30,
  defaultCrewSize: 2,
  workdayHours: 8,
  weatherReserveFactor: 1.3,
  theme: { ...defaultThemeSettings },
};

export interface Product {
  id: string;
  name: string;
  unit: string;
  /** Ostohinta (alv0). Materiaalirivit käyttävät tätä. */
  unitPriceVat0: number;
  /** Ostohinta (alv0). Puuttuu vanhoissa riveissä → `unitPriceVat0`. */
  purchasePriceVat0?: number;
  /** Myyntihinta (alv0). Puuttuu vanhoissa riveissä → ostohinta. */
  salePriceVat0?: number;
  description?: string;
  /** Kaavoissa: menekki, ostohinta, myyntihinta, tyokerroin jne. */
  attributes?: Record<string, number>;
  /** Tuoterakenteet joihin materiaali kuuluu. */
  structureIds?: string[];
  /** Ensimmäinen rakenne; vanha kenttä, synkataan structureIds-listasta. */
  structureId?: string;
  /** Näyttöjärjestys Tuotteet-listassa ja tuotelistakentässä. Puuttuu vanhoissa → 0. */
  sortOrder?: number;
  createdAt: Date;
}

export interface CalculationLine {
  id: string;
  productId?: string;
  productName: string;
  unit: string;
  unitPriceVat0: number;
  quantity: number;
  lineTotalVat0: number;
}

export interface FormSnapshotField {
  key: string;
  label: string;
  unit?: string;
  value: string;
  pageTitle?: string;
}

export interface FormSnapshot {
  formId: string;
  formVersion: number;
  /** Näytettävät yhteenvedon rivit (formatoidut). */
  fields: FormSnapshotField[];
  /**
   * Raaka wizard-syöte (sis. piilotetut kentät ja computed-ylikirjoitukset).
   * Tarvitaan muokkaukseen; vanhoissa tallenteissa voi puuttua.
   */
  fieldValues?: Record<string, string>;
  /**
   * Kotitalousvähennyksen henkilömäärä. Valinnainen avain laskelman `form_snapshot`-JSON:ssa
   * (ei lomakepohjan JSON:ia, ei skeemamuutosta). Puuttuva avain = 1. Vanha sovellus ohittaa avaimen.
   */
  ktvPersons?: number;
  /**
   * Tulostetaanko kotitalousvähennyslaskelma omalle sivulleen.
   * Valinnainen avain laskelman `form_snapshot`-JSON:ssa (ei lomakepohjan JSON:ia, ei skeemamuutosta).
   * Puuttuva avain = true. Vain `false` jättää KTV-sivun pois. Henkilömäärä on yhä `ktvPersons`.
   */
  ktvPageIncluded?: boolean;
  /**
   * Urakkakortin tila. Valinnainen avain samassa `form_snapshot`-JSON:ssa.
   * Puuttuva avain = `alihankkija`. Ei lomakepohjan avain eikä SQL-migraatio.
   */
  urakkakorttiMode?: 'alihankkija' | 'tyontekija';
  /**
   * Urakkakortin Huomioitavaa-teksti. Valinnainen avain samassa `form_snapshot`-JSON:ssa.
   * Puuttuva avain = esitäyttö asiakkaan lisätiedoista (`customer`-JSON:n `notes`).
   * Tyhjä merkkijono = osiota ei tulosteta. Ei kuulu tarjoukseen.
   */
  urakkakorttiHuomioitavaa?: string;
  /**
   * Urakkakortti ei tulosta urakkahintoja eikä yhteensä-riviä. Valinnainen avain samassa
   * `form_snapshot`-JSON:ssa. Puuttuva tai muu kuin `true` = hinnat näytetään.
   * Ei lomakepohjan avain eikä SQL-migraatio. Ei kuulu tarjoukseen.
   */
  urakkakorttiHidePrices?: boolean;
  /**
   * Urakkakortin rivikohtaiset urakkahinnat (alv0) ennen sivukulukerrointa.
   * Avain on `StructureLine.id`. Puuttuva kartta tai puuttuva rivin avain = laskettu urakka.
   * Rivin järjestyksen vaihto ei vaihda id:tä, joten yliajo seuraa riviä.
   * Poistetun rivin avain ohitetaan. Uusi rivi saa uuden id:n eikä peri yliajoa.
   * Tyhjä kartta poistetaan. Ei kuulu tarjoukseen eikä SQL-migraatioon.
   */
  urakkakorttiRivihinnat?: Record<string, number>;
  /**
   * Yritystarjouksen ALV koko laskelmalle. Valinnainen avain samassa `form_snapshot`-JSON:ssa
   * (ei lomakepohjan JSON:ia, ei skeemamuutosta). `'alv0'` = veroton otsikko "Alv 0 %".
   * `'sis'` = bruttohinnat ja otsikon Alv-% on rivin verokanta. Puuttuva tai muu arvo = `'alv0'`.
   * Rivin `pricesIncludeVat` ei vaikuta yritystarjoukseen. Käänteinen ALV on aina `'alv0'`.
   */
  businessVatMode?: 'alv0' | 'sis';
  /**
   * Tarjouksen voimassaolo kalenteripäivinä. Valinnainen avain samassa `form_snapshot`-JSON:ssa.
   * Puuttuva avain = yrityksen asetus (oletus 31). Arvo 1–365. Oletusta vastaavaa arvoa ei tallenneta.
   */
  offerValidDays?: number;
}

export interface CalculationRecord {
  id: string;
  projectName: string;
  customer?: string;
  groupDurationHours: number;
  crewSize: number;
  hourlyRate: number;
  marginPercent: number;
  commissionPercent: number;
  contractPriceVat0: number;
  materialsVat0: number;
  marginEur: number;
  commissionEur: number;
  totalPriceVat0: number;
  vatPercent: number;
  vatAmount: number;
  totalPriceVat: number;
  workDurationDays: number;
  discountPercent: number;
  discountEur: number;
  totalPriceVatBeforeDiscount: number;
  totalPriceVat0BeforeDiscount: number;
  createdAt: Date;
  formSnapshot?: FormSnapshot;
  lines: CalculationLine[];
  customerId?: string;
  deliveryScheduleText?: string;
  travelTimeHoursOneWay?: number;
  structureLines?: StructureLine[];
  /** Tarjousnumero (v1.3). Myönnetään ensimmäisestä tarjous-PDF:stä; säilyy muokkauksessa. */
  offerNumber?: number;
}

export type StructureLineOverride =
  | 'unitPrice'
  | 'materials'
  | 'discount'
  | 'quantity'
  | 'unit'
  | 'contractPrice'
  | 'workDurationDisplay';

/** Urakkakortin materiaalimäärä. Tallennetaan rivin `structure_lines`-JSON:iin. */
export interface MaterialQuantityRow {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unit?: string;
  source: 'form' | 'manual';
  /**
   * `product_select`-kenttä, josta esitäyttö syntyi.
   * Muokattu lomakerivi säilyttää avaimen (`source: 'manual'`) ja estää saman kentän esitäytön.
   */
  fieldKey?: string;
}

export interface StructureLine {
  id: string;
  structureId: string;
  name: string;
  quantity: number;
  unit?: string;
  unitPriceVat0: number;
  materialsVat0: number;
  discountPercent: number;
  vatPercent: number;
  contractPriceVat0: number;
  workDurationDays: number;
  /**
   * Yhteenvedossa näytettävä kesto (pv), säävaraus jo mukana.
   * Yliajo (`workDurationDisplay`) ei muuta laskentaa.
   */
  displayWorkDurationDays?: number;
  commissionPercent: number;
  commissionEur: number;
  marginEur: number;
  marginPercent: number;
  /** true = kortilla hinta/materiaalit ALV:llisina (oletus). */
  pricesIncludeVat?: boolean;
  /** Rivin lisätiedot; tuoterakenne omistaa kentän, oletusteksti kopioidaan rakenteesta. */
  additionalInfo?: string;
  fieldValues: Record<string, string>;
  formFilled: boolean;
  formVersion?: number;
  snapshot?: FormSnapshot;
  overrides: StructureLineOverride[];
  /**
   * Urakkakortin materiaalimäärät. Puuttuva avain = vanha laskelma (ei kirjoiteta uudelleen).
   * Tyhjä taulukko = käyttäjä poisti rivit (taulukkoa ei tulosteta).
   */
  materialQuantities?: MaterialQuantityRow[];
}

export interface CustomerInfo {
  name: string;
  customerType?: CustomerType;
  reverseVat?: boolean;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  postalLocality?: string;
  notes?: string;
}

export function emptyCustomerInfo(): CustomerInfo {
  return { name: '', customerType: 'private', reverseVat: false };
}

export function serializeCustomerDetails(customer: CustomerInfo): string {
  return JSON.stringify({
    customerType: customer.customerType ?? 'private',
    reverseVat: customer.reverseVat ?? false,
    phone: customer.phone?.trim() || undefined,
    email: customer.email?.trim() || undefined,
    address: customer.address?.trim() || undefined,
    postalCode: customer.postalCode?.trim() || undefined,
    postalLocality: customer.postalLocality?.trim() || undefined,
    notes: customer.notes?.trim() || undefined,
  });
}

export function parseCustomerDetails(raw?: string | null): Omit<CustomerInfo, 'name'> {
  if (!raw?.trim()) {
    return { customerType: 'private', reverseVat: false };
  }
  try {
    const parsed = JSON.parse(raw) as Omit<CustomerInfo, 'name'>;
    return {
      customerType: parsed.customerType ?? 'private',
      reverseVat: parsed.reverseVat ?? false,
      phone: parsed.phone,
      email: parsed.email,
      address: parsed.address,
      postalCode: parsed.postalCode,
      postalLocality: parsed.postalLocality,
      notes: parsed.notes,
    };
  } catch {
    return { notes: raw, customerType: 'private', reverseVat: false };
  }
}

export function customerFromRecord(record: CalculationRecord): CustomerInfo {
  return {
    name: record.projectName,
    ...parseCustomerDetails(record.customer),
  };
}

export interface WizardLineDraft {
  product: Product;
  quantity: number;
}

export interface WizardDraft {
  customer: CustomerInfo;
  groupDurationHours?: number;
  crewSize?: number;
  marginPercent?: number;
  commissionPercent?: number;
  lines: WizardLineDraft[];
}

export interface PersistedWizardLineDraft {
  productId: string;
  quantity: number;
}

export interface PersistedWizardDraft {
  step: number;
  customerName: string;
  customerType: CustomerType;
  reverseVat: boolean;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerPostalCode?: string;
  customerPostalLocality?: string;
  customerNotes: string;
  duration: string;
  fieldValues?: Record<string, string>;
  lines: PersistedWizardLineDraft[];
  updatedAt: number;
  /** Jos asetettu, Laske päivittää tämän historian rivin eikä luo uutta. */
  editCalculationId?: string;
  originalCreatedAt?: number;
  editFormVersion?: number;
  customerId?: string;
  deliveryScheduleText?: string;
  travelTimeOneWay?: string;
  structureLines?: StructureLine[];
  /** Yritystarjouksen ALV. Puuttuva = alv0. Ei SQL-saraketta. */
  businessVatMode?: 'alv0' | 'sis';
}
