export interface AppSettings {
  vatPercent: number;
  defaultMarginPercent: number;
  defaultCommissionPercent: number;
  defaultHourlyRate: number;
  defaultCrewSize: number;
  workdayHours: number;
  wizardStepOrder: WizardStepId[];
  theme: ThemeSettings;
}

export type WizardStepId = 'customer' | 'duration' | 'materials';

export const DEFAULT_WIZARD_STEP_ORDER: WizardStepId[] = ['customer', 'duration', 'materials'];

export const WIZARD_STEP_META: Record<WizardStepId, { title: string }> = {
  customer: { title: 'Asiakas' },
  duration: { title: 'Työryhmän arvioitu kesto (pv)' },
  materials: { title: 'Materiaalit' },
};

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
  defaultCommissionPercent: 7,
  defaultHourlyRate: 30,
  defaultCrewSize: 2,
  workdayHours: 8,
  wizardStepOrder: [...DEFAULT_WIZARD_STEP_ORDER],
  theme: { ...defaultThemeSettings },
};

export interface Product {
  id: string;
  name: string;
  unit: string;
  unitPriceVat0: number;
  description?: string;
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
  createdAt: Date;
  lines: CalculationLine[];
}

export interface CustomerInfo {
  name: string;
  customerType?: CustomerType;
  reverseVat?: boolean;
  phone?: string;
  email?: string;
  address?: string;
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

export function materialsTotal(lines: WizardLineDraft[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.product.unitPriceVat0, 0);
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
  customerNotes: string;
  duration: string;
  lines: PersistedWizardLineDraft[];
  updatedAt: number;
}
