export interface AppSettings {
  vatPercent: number;
  defaultMarginPercent: number;
  defaultCommissionPercent: number;
  defaultHourlyRate: number;
  defaultCrewSize: number;
  workdayHours: number;
}

export const defaultSettings: AppSettings = {
  vatPercent: 25.5,
  defaultMarginPercent: 35,
  defaultCommissionPercent: 7,
  defaultHourlyRate: 30,
  defaultCrewSize: 2,
  workdayHours: 8,
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
  vatAmount: number;
  totalPriceVat: number;
  workDurationDays: number;
  createdAt: Date;
  lines: CalculationLine[];
}

export interface WizardLineDraft {
  product: Product;
  quantity: number;
}

export interface WizardDraft {
  projectName: string;
  customer: string;
  groupDurationHours?: number;
  crewSize?: number;
  marginPercent?: number;
  commissionPercent?: number;
  lines: WizardLineDraft[];
}

export function materialsTotal(lines: WizardLineDraft[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.product.unitPriceVat0, 0);
}
