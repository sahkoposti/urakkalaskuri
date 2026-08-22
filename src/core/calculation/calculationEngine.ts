export interface CalculationInput {
  groupDurationHours: number;
  crewSize: number;
  hourlyRate: number;
  materialsVat0: number;
  marginPercent: number;
  commissionPercent: number;
  vatPercent: number;
  workdayHours: number;
}

export interface CalculationResult {
  contractPriceVat0: number;
  materialsVat0: number;
  marginEur: number;
  commissionEur: number;
  totalPriceVat0: number;
  vatAmount: number;
  totalPriceVat: number;
  materialsVat: number;
  workDurationDays: number;
}

export class CalculationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculationValidationError';
  }
}

export function runCalculation(input: CalculationInput): CalculationResult {
  if (input.groupDurationHours <= 0) {
    throw new CalculationValidationError('Työryhmän keston on oltava suurempi kuin 0.');
  }
  if (input.crewSize <= 0) {
    throw new CalculationValidationError('Työryhmän koon on oltava vähintään 1.');
  }
  if (input.hourlyRate <= 0) {
    throw new CalculationValidationError('Tuntihinnan on oltava suurempi kuin 0.');
  }
  if (input.workdayHours <= 0) {
    throw new CalculationValidationError('Työpäivän pituuden on oltava suurempi kuin 0.');
  }

  const margin = input.marginPercent / 100;
  const commission = input.commissionPercent / 100;
  if (margin + commission >= 1) {
    throw new CalculationValidationError(
      'Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.',
    );
  }

  const contractPrice = input.groupDurationHours * input.crewSize * input.hourlyRate;
  const materials = input.materialsVat0;
  const totalPriceVat0 = (contractPrice + materials) / (1 - margin - commission);
  const marginEur = totalPriceVat0 * margin;
  const commissionEur = totalPriceVat0 * commission;
  const vatRate = input.vatPercent / 100;
  const vatAmount = totalPriceVat0 * vatRate;
  const totalPriceVat = totalPriceVat0 + vatAmount;
  const materialsVat = materials * (1 + vatRate);
  const workDurationDays = input.groupDurationHours / input.workdayHours;

  return {
    contractPriceVat0: contractPrice,
    materialsVat0: materials,
    marginEur,
    commissionEur,
    totalPriceVat0,
    vatAmount,
    totalPriceVat,
    materialsVat,
    workDurationDays,
  };
}
