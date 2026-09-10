import type { FormDefinition } from '@/src/core/form/types';
import type {
  CustomerInfo,
  CustomerType,
  StructureLine,
  StructureLineOverride,
} from '@/src/core/models/types';

export const DEFAULT_STRUCTURE_ID = 'default';
/** Pickerin „Ei pohjaa”: tyhjä rivi ilman lomakepohjaa. Ei tietokantariviä. */
export const MANUAL_STRUCTURE_ID = 'manual';

export type { StructureLine, StructureLineOverride };

export interface ProductStructure {
  id: string;
  name: string;
  unit?: string;
  form: FormDefinition;
  commissionPercent: number;
  /** Kopioidaan riville valittaessa. Valinnainen. */
  defaultAdditionalInfo?: string;
  /** Rivin Hinta € (alv0) valittaessa. Lomake yliajaa, ellei kortilla ole muokattu. */
  defaultUnitPriceVat0?: number;
  /** Rivin työn hinta / urakka (alv0) valittaessa. Lomake yliajaa, ellei kortilla ole muokattu. */
  defaultContractPriceVat0?: number;
  /** Rivin Materiaalit € (alv0) valittaessa. Lomake yliajaa, ellei kortilla ole muokattu. */
  defaultMaterialsVat0?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function isManualStructureId(id: string): boolean {
  return id === MANUAL_STRUCTURE_ID;
}

export interface CustomerRecord {
  id: string;
  name: string;
  customerType: CustomerType;
  reverseVat: boolean;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  postalLocality?: string;
  notes?: string;
  updatedAt: Date;
}

function emptyLineBase(input: {
  id: string;
  structureId: string;
  name: string;
  unit?: string;
  vatPercent: number;
  commissionPercent: number;
  unitPriceVat0?: number;
  materialsVat0?: number;
  contractPriceVat0?: number;
  additionalInfo?: string;
}): StructureLine {
  const additionalInfo = input.additionalInfo?.trim();
  return {
    id: input.id,
    structureId: input.structureId,
    name: input.name,
    quantity: 1,
    unit: input.unit,
    unitPriceVat0: input.unitPriceVat0 ?? 0,
    materialsVat0: input.materialsVat0 ?? 0,
    discountPercent: 0,
    vatPercent: input.vatPercent,
    contractPriceVat0: input.contractPriceVat0 ?? 0,
    workDurationDays: 0,
    commissionPercent: input.commissionPercent,
    commissionEur: 0,
    marginEur: 0,
    marginPercent: 0,
    pricesIncludeVat: true,
    additionalInfo: additionalInfo || undefined,
    fieldValues: {},
    formFilled: false,
    overrides: [],
  };
}

export function emptyStructureLine(input: {
  id: string;
  structure: ProductStructure;
  vatPercent: number;
}): StructureLine {
  return emptyLineBase({
    id: input.id,
    structureId: input.structure.id,
    name: input.structure.name,
    unit: input.structure.unit,
    vatPercent: input.vatPercent,
    commissionPercent: input.structure.commissionPercent,
    unitPriceVat0: input.structure.defaultUnitPriceVat0,
    materialsVat0: input.structure.defaultMaterialsVat0,
    contractPriceVat0: input.structure.defaultContractPriceVat0,
    additionalInfo: input.structure.defaultAdditionalInfo,
  });
}

/** Tyhjä rivi ilman lomakepohjaa („Ei pohjaa”). */
export function emptyManualStructureLine(input: {
  id: string;
  vatPercent: number;
}): StructureLine {
  return emptyLineBase({
    id: input.id,
    structureId: MANUAL_STRUCTURE_ID,
    name: 'Tuoterakenne',
    vatPercent: input.vatPercent,
    commissionPercent: 0,
  });
}

export function customerRecordToInfo(record: CustomerRecord): CustomerInfo {
  return {
    name: record.name,
    customerType: record.customerType,
    reverseVat: record.reverseVat,
    phone: record.phone,
    email: record.email,
    address: record.address,
    postalCode: record.postalCode,
    postalLocality: record.postalLocality,
    notes: record.notes,
  };
}
