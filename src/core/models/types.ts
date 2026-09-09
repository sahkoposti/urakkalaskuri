export interface AppSettings {
  vatPercent: number;
  defaultMarginPercent: number;
  /** Myyntihinta (alv0), jossa kate on marginLowPercent. */
  marginLowAmount: number;
  marginLowPercent: number;
  /** Myyntihinta (alv0), jossa kate on marginHighPercent. */
  marginHighAmount: number;
  marginHighPercent: number;
  defaultCommissionPercent: number;
  defaultHourlyRate: number;
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
  unitPriceVat0: number;
  description?: string;
  /** Kaavoissa: menekki, yksikkohinta, tyokerroin jne. */
  attributes?: Record<string, number>;
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
}
