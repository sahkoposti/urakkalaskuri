import { parseTravelTimeHoursOneWay } from '@/src/core/form/calculationFormulaContext';
import type { CalculationRecord, PersistedWizardDraft } from '@/src/core/models/types';
import { serializeCustomerDetails } from '@/src/core/models/types';
import { applySiteAddressSnapshot } from '@/src/core/pdf/siteAddress';

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

/**
 * Avoin sessio kirjoitetaan samaan laskelmaan.
 * Valmis rivi muuttuu keskeneräiseksi eikä saa kopiota.
 * Hinnat, rivit, tarjousnumero ja liitteiden avain (id) säilyvät.
 */
export function overlayDraftCalculation(
  previous: CalculationRecord,
  draft: PersistedWizardDraft,
): CalculationRecord {
  const fresh = draftCalculationFromWizard(draft, previous.id, previous.createdAt);
  const snapshot = {
    ...(fresh.formSnapshot ?? { formId: 'wizard-draft', formVersion: 0, fields: [] }),
    ...(previous.formSnapshot ?? {}),
    wizardDraft: fresh.formSnapshot?.wizardDraft,
    fields: previous.formSnapshot?.fields?.length
      ? previous.formSnapshot.fields
      : (fresh.formSnapshot?.fields ?? []),
    formId: previous.formSnapshot?.formId || fresh.formSnapshot?.formId || 'wizard-draft',
    formVersion: previous.formSnapshot?.formVersion ?? fresh.formSnapshot?.formVersion ?? 0,
  };
  const withSite = applySiteAddressSnapshot(
    { ...previous, formSnapshot: snapshot },
    draft.siteAddress ?? '',
    draft.siteAddressTouched === true,
  );
  return {
    ...previous,
    projectName: fresh.projectName,
    customer: fresh.customer,
    customerId: draft.customerId,
    deliveryScheduleText: draft.deliveryScheduleText ?? previous.deliveryScheduleText,
    travelTimeHoursOneWay:
      draft.travelTimeOneWay !== undefined
        ? parseTravelTimeHoursOneWay(draft.travelTimeOneWay) || undefined
        : previous.travelTimeHoursOneWay,
    structureLines: draft.structureLines ?? previous.structureLines,
    status: CALCULATION_STATUS_DRAFT,
    formSnapshot: withSite.formSnapshot,
    createdAt: previous.createdAt,
    offerNumber: previous.offerNumber,
    lines: previous.lines,
  };
}

/** Uusi sessio tai olemassa olevan rivin päivitys. Ei luo toista id:tä. */
export function calculationForWizardSession(
  draft: PersistedWizardDraft,
  previous: CalculationRecord | null,
  id: string,
  createdAt: Date,
): CalculationRecord {
  if (!previous) {
    return applySiteAddressSnapshot(
      draftCalculationFromWizard(draft, id, createdAt),
      draft.siteAddress ?? '',
      draft.siteAddressTouched === true,
    );
  }
  return overlayDraftCalculation(previous, draft);
}
