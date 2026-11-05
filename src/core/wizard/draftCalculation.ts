import type { CalculationRecord, PersistedWizardDraft } from '@/src/core/models/types';
import { serializeCustomerDetails } from '@/src/core/models/types';

export const CALCULATION_STATUS_DRAFT = 'draft' as const;
export const CALCULATION_STATUS_COMPLETE = 'complete' as const;

export type CalculationStatus = typeof CALCULATION_STATUS_DRAFT | typeof CALCULATION_STATUS_COMPLETE;

/** Puuttuva tai muu arvo on valmis laskelma (vanha rivi ennen saraketta). */
export function calculationStatus(record: { status?: string | null } | null | undefined): CalculationStatus {
  return record?.status === CALCULATION_STATUS_DRAFT ? CALCULATION_STATUS_DRAFT : CALCULATION_STATUS_COMPLETE;
}

export function isDraftCalculation(record: { status?: string | null } | null | undefined): boolean {
  return calculationStatus(record) === CALCULATION_STATUS_DRAFT;
}

export function wizardDraftFromCalculation(record: CalculationRecord): PersistedWizardDraft | null {
  const stored = record.formSnapshot?.wizardDraft;
  if (!stored || typeof stored !== 'object') return null;
  return stored;
}

/**
 * Tallentaa wizard-tilan laskelmariville. Hinnat ovat nollia, koska laskentaa ei ole ajettu.
 * Tila on `form_snapshot.wizardDraft` (ei uutta saraketta, ei lomakepohjaa).
 */
export function draftCalculationFromWizard(
  draft: PersistedWizardDraft,
  id: string,
  createdAt: Date,
): CalculationRecord {
  const name = draft.customerName.trim() || 'Keskeneräinen';
  const payload: PersistedWizardDraft = { ...draft, editCalculationId: id };
  return {
    id,
    projectName: name,
    customer: serializeCustomerDetails({
      name,
      customerType: draft.customerType,
      reverseVat: draft.reverseVat,
      phone: draft.customerPhone,
      email: draft.customerEmail,
      address: draft.customerAddress,
      postalCode: draft.customerPostalCode,
      postalLocality: draft.customerPostalLocality,
      notes: draft.customerNotes,
    }),
    groupDurationHours: 0,
    crewSize: 1,
    hourlyRate: 0,
    marginPercent: 0,
    commissionPercent: 0,
    contractPriceVat0: 0,
    materialsVat0: 0,
    marginEur: 0,
    commissionEur: 0,
    totalPriceVat0: 0,
    vatPercent: 0,
    vatAmount: 0,
    totalPriceVat: 0,
    workDurationDays: 0,
    discountPercent: 0,
    discountEur: 0,
    totalPriceVatBeforeDiscount: 0,
    totalPriceVat0BeforeDiscount: 0,
    createdAt,
    formSnapshot: {
      formId: 'wizard-draft',
      formVersion: draft.editFormVersion ?? 0,
      fields: [],
      wizardDraft: payload,
    },
    lines: [],
    customerId: draft.customerId,
    deliveryScheduleText: draft.deliveryScheduleText,
    structureLines: draft.structureLines,
    status: CALCULATION_STATUS_DRAFT,
  };
}
