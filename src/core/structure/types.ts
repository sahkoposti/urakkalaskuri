import type { FormDefinition } from '@/src/core/form/types';
import type {
  CustomerInfo,
  CustomerType,
  StructureLine,
  StructureLineOverride,
} from '@/src/core/models/types';

export const DEFAULT_STRUCTURE_ID = 'default';

export type { StructureLine, StructureLineOverride };

export interface ProductStructure {
  id: string;
  name: string;
  unit?: string;
  form: FormDefinition;
  commissionPercent: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
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

export function emptyStructureLine(input: {
  id: string;
  structure: ProductStructure;
  vatPercent: number;
}): StructureLine {
  return {
    id: input.id,
    structureId: input.structure.id,
    name: input.structure.name,
    quantity: 1,
    unit: input.structure.unit,
    unitPriceVat0: 0,
    materialsVat0: 0,
    discountPercent: 0,
    vatPercent: input.vatPercent,
    contractPriceVat0: 0,
    workDurationDays: 0,
    commissionPercent: input.structure.commissionPercent,
    commissionEur: 0,
    marginEur: 0,
    marginPercent: 0,
    pricesIncludeVat: true,
    fieldValues: {},
    formFilled: false,
    overrides: [],
  };
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
