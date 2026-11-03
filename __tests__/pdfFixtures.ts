import { defaultCompanyProfile } from '../src/core/company/defaultCompany';
import { createMinimalFormDefinition } from '../src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { buildFormSnapshot } from '../src/core/form/formSummaryHelpers';
import type { FormDefinition } from '../src/core/form/types';
import {
  type CalculationRecord,
  type CustomerInfo,
  defaultSettings,
  serializeCustomerDetails,
  type StructureLine,
} from '../src/core/models/types';
import type { BuildPdfContextInput } from '../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../src/core/pdf/defaultOfferSettings';
import type { ProductStructure } from '../src/core/structure/types';

/** Testidata PDF-testeille (ei oikeita asiakastietoja). */
export const form: FormDefinition = normalizeFormDefinition(createMinimalFormDefinition());
export const snapshot = (area: string) =>
  buildFormSnapshot(form, { kiintea_seinapinta_ala_m2: area, laudoitustyyppi: '1.15' }, {
    kiintea_seinapinta_ala_m2: Number(area),
    laudoitustyyppi: 1.15,
  });

export const structure = (id: string, name: string): ProductStructure => ({
  id,
  name,
  form,
  commissionPercent: 5,
  crewSize: 2,
  sortOrder: 0,
  createdAt: new Date(2026, 9, 1),
  updatedAt: new Date(2026, 9, 1),
});

export function line(id: string, structureId: string, name: string, area = '120'): StructureLine {
  return {
    id,
    structureId,
    name,
    quantity: 1,
    unitPriceVat0: 1000,
    materialsVat0: 200,
    discountPercent: 0,
    vatPercent: 25.5,
    contractPriceVat0: 1000,
    workDurationDays: 3,
    commissionPercent: 5,
    commissionEur: 77.77,
    marginEur: 333.33,
    marginPercent: 20,
    fieldValues: { kiintea_seinapinta_ala_m2: area },
    formFilled: true,
    snapshot: snapshot(area),
    overrides: [],
  };
}

export function record(customer: Partial<CustomerInfo>, extra: Partial<CalculationRecord> = {}): CalculationRecord {
  return {
    id: 'calc1',
    projectName: 'Matti Meikäläinen',
    customer: serializeCustomerDetails({
      name: 'Matti Meikäläinen',
      customerType: 'private',
      reverseVat: false,
      address: 'Testitie 1',
      postalCode: '20100',
      postalLocality: 'Turku',
      phone: '040 000 0000',
      ...customer,
    }),
    groupDurationHours: 10,
    crewSize: 2,
    hourlyRate: 50,
    marginPercent: 20,
    commissionPercent: 5,
    contractPriceVat0: 2000,
    materialsVat0: 400,
    marginEur: 333.33,
    commissionEur: 77.77,
    totalPriceVat0: 2000,
    vatPercent: 25.5,
    vatAmount: 510,
    totalPriceVat: 2510,
    workDurationDays: 3,
    discountPercent: 0,
    discountEur: 0,
    totalPriceVatBeforeDiscount: 2510,
    totalPriceVat0BeforeDiscount: 2000,
    createdAt: new Date(2026, 9, 1),
    lines: [],
    structureLines: [line('l1', 's1', 'Ulkomaalaus')],
    ...extra,
  };
}

export function input(rec: CalculationRecord, overrides: Partial<BuildPdfContextInput> = {}): BuildPdfContextInput {
  return {
    record: rec,
    company: { ...defaultCompanyProfile },
    offerCompany: { ...defaultOfferCompanySettings },
    offerStructureSettings: {
      s1: { additionalInfoText: 'Sisältää telineet.', offerPages: [] },
      s2: { additionalInfoText: 'Toinen teksti', offerPages: [] },
    },
    structures: [structure('s1', 'Ulkomaalaus'), structure('s2', 'Sokkeli')],
    products: [],
    settings: defaultSettings,
    generatedAt: new Date(2026, 9, 10),
    offerNumber: 10285,
    ...overrides,
  };
}

