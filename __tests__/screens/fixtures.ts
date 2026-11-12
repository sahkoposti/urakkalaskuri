import { createMinimalFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { defaultFormDebugSettings } from '@/src/core/form/types';
import type {
  CalculationRecord,
  PersistedWizardDraft,
  Product,
} from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';
import type { CustomerRecord, ProductStructure } from '@/src/core/structure/types';
import { DEFAULT_STRUCTURE_ID } from '@/src/core/structure/types';
import { structure } from '../pdfFixtures';
import { record as pdfRecord } from '../pdfFixtures';

/** Kiinteä kellonaika näyttösnapshotteihin (2026-10-10T12:00:00.000Z, timezone-agnostic). */
export const SCREEN_FIXED_DATE = new Date('2026-10-10T12:00:00.000Z');
export const SCREEN_FIXED_TIMESTAMP = SCREEN_FIXED_DATE.getTime();

const form = normalizeFormDefinition(createMinimalFormDefinition());

export const fixtureStructures: ProductStructure[] = [
  { ...structure('s1', 'Ulkomaalaus'), createdAt: SCREEN_FIXED_DATE, updatedAt: SCREEN_FIXED_DATE },
  { ...structure('s2', 'Sokkeli'), createdAt: SCREEN_FIXED_DATE, updatedAt: SCREEN_FIXED_DATE },
];

export const fixtureProducts: Product[] = [
  {
    id: 'prod_a',
    name: 'Nova 7',
    unit: 'l',
    unitPriceVat0: 45,
    purchasePriceVat0: 40,
    salePriceVat0: 45,
    structureIds: ['s1', 's2'],
    sortOrder: 0,
    createdAt: SCREEN_FIXED_DATE,
  },
  {
    id: 'prod_b',
    name: 'Pensseli 100mm',
    unit: 'kpl',
    unitPriceVat0: 12,
    purchasePriceVat0: 10,
    salePriceVat0: 12,
    structureIds: ['s1'],
    sortOrder: 1,
    createdAt: SCREEN_FIXED_DATE,
  },
];

export const fixtureCustomers: CustomerRecord[] = [
  {
    id: 'cust_fixture_1',
    name: 'Fiktiivinen Asiakas',
    customerType: 'private',
    reverseVat: false,
    phone: '040 111 2222',
    email: 'fiktiivinen@esimerkki.test',
    address: 'Kultatie 7',
    postalCode: '33100',
    postalLocality: 'Tampere',
    notes: 'Snapshot-fixture',
    updatedAt: SCREEN_FIXED_DATE,
  },
  {
    id: 'cust_fixture_2',
    name: 'Toinen Fiktiivinen',
    customerType: 'business',
    reverseVat: true,
    phone: '050 999 8888',
    email: 'toinen@esimerkki.test',
    address: 'Esimerkkikatu 2',
    postalCode: '20100',
    postalLocality: 'Turku',
    notes: '',
    updatedAt: SCREEN_FIXED_DATE,
  },
];

const calcComplete: CalculationRecord = {
  ...pdfRecord({}, { projectName: 'Fiktiivinen Kohde', createdAt: SCREEN_FIXED_DATE }),
  id: 'calc_fixture_1',
  status: 'complete',
};

const calcDraft: CalculationRecord = {
  ...pdfRecord({}, { projectName: 'Luonnos-fixture', createdAt: SCREEN_FIXED_DATE }),
  id: 'calc_fixture_draft',
  status: 'draft',
};

export const fixtureCalculations: CalculationRecord[] = [calcComplete, calcDraft];

export const fixtureWizardDraft: PersistedWizardDraft = {
  step: 1,
  customerName: 'Fiktiivinen Asiakas',
  customerType: 'private',
  reverseVat: false,
  customerPhone: '040 111 2222',
  customerEmail: 'fiktiivinen@esimerkki.test',
  customerAddress: 'Kultatie 7',
  customerPostalCode: '33100',
  customerPostalLocality: 'Tampere',
  customerNotes: 'Snapshot-fixture',
  duration: '3',
  lines: [],
  updatedAt: SCREEN_FIXED_TIMESTAMP,
  customerId: 'cust_fixture_1',
  structureLines: [],
};

const noopAsync = async () => {};

export type FixtureAppContext = {
  ready: boolean;
  settings: typeof defaultSettings;
  products: Product[];
  calculations: CalculationRecord[];
  structures: ProductStructure[];
  customers: CustomerRecord[];
  activeStructureId: string;
  wizardDraft: PersistedWizardDraft | null;
  formDefinition: ReturnType<typeof normalizeFormDefinition>;
  formDebug: typeof defaultFormDebugSettings;
  refreshSettings: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshCalculations: () => Promise<void>;
  refreshWizardDraft: () => Promise<void>;
  refreshFormSettings: () => Promise<void>;
  refreshStructures: () => Promise<void>;
  refreshCustomers: () => Promise<void>;
  setActiveStructure: (id: string) => Promise<void>;
};

export function buildFixtureAppContext(overrides: Partial<FixtureAppContext> = {}): FixtureAppContext {
  return {
    ready: true,
    settings: defaultSettings,
    products: fixtureProducts,
    calculations: fixtureCalculations,
    structures: fixtureStructures,
    customers: fixtureCustomers,
    activeStructureId: DEFAULT_STRUCTURE_ID,
    wizardDraft: fixtureWizardDraft,
    formDefinition: form,
    formDebug: defaultFormDebugSettings,
    refreshSettings: noopAsync,
    refreshProducts: noopAsync,
    refreshCalculations: noopAsync,
    refreshWizardDraft: noopAsync,
    refreshFormSettings: noopAsync,
    refreshStructures: noopAsync,
    refreshCustomers: noopAsync,
    setActiveStructure: noopAsync,
    ...overrides,
  };
}

export const mockDb = {
  beginNewCalculation: jest.fn(noopAsync),
  deleteCustomer: jest.fn(noopAsync),
  deleteProduct: jest.fn(noopAsync),
  upsertCustomer: jest.fn(noopAsync),
  saveWizardDraft: jest.fn(noopAsync),
  saveWizardViewSession: jest.fn(noopAsync),
  updateCalculationCustomerSnapshots: jest.fn(noopAsync),
  getCustomers: jest.fn(async () => fixtureCustomers),
};

export const mockFixtureApp = buildFixtureAppContext();
