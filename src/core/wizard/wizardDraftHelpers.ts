import type {
  PersistedWizardDraft,
  Product,
  StructureLine,
  WizardDraft,
  WizardLineDraft,
} from '@/src/core/models/types';
import { emptyCustomerInfo } from '@/src/core/models/types';
import { hasFieldValueContent } from '@/src/core/wizard/wizardPageHelpers';

export type WizardFormState = {
  step: number;
  customerName: string;
  customerType: 'private' | 'business';
  reverseVat: boolean;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerPostalCode: string;
  customerPostalLocality: string;
  customerNotes: string;
  duration: string;
  fieldValues: Record<string, string>;
  lines: WizardLineDraft[];
  customerId?: string;
  deliveryScheduleText?: string;
  structureLines?: StructureLine[];
};

export type WizardDraftEditMeta = {
  editCalculationId?: string | null;
  originalCreatedAt?: Date | number | null;
  editFormVersion?: number | null;
};

/** Ensimmäinen ei-tyhjä id (Expo-router voi antaa merkkijonotaulukon). */
export function firstNonEmptyId(
  ...candidates: Array<string | string[] | null | undefined>
): string | undefined {
  for (const value of candidates) {
    const id = Array.isArray(value) ? value[0] : value;
    if (typeof id === 'string' && id.trim().length > 0) {
      return id.trim();
    }
  }
  return undefined;
}

export function editMetaFromDraft(
  draft?: PersistedWizardDraft | WizardDraftEditMeta | null,
): WizardDraftEditMeta {
  if (!draft) return {};
  return {
    editCalculationId: firstNonEmptyId(draft.editCalculationId),
    originalCreatedAt: draft.originalCreatedAt,
    editFormVersion: draft.editFormVersion,
  };
}

/** Säilyttää tunnetun laskelma-id:n — myöhempi kirjoitus ei saa pudottaa sitä. */
export function mergeWizardDraftEditMeta(
  ...sources: Array<PersistedWizardDraft | WizardDraftEditMeta | null | undefined>
): WizardDraftEditMeta {
  let editCalculationId: string | undefined;
  let originalCreatedAt: Date | number | null | undefined;
  let editFormVersion: number | null | undefined;
  for (const source of sources) {
    if (!source) continue;
    if (!editCalculationId) {
      editCalculationId = firstNonEmptyId(source.editCalculationId);
    }
    if (originalCreatedAt == null && source.originalCreatedAt != null) {
      originalCreatedAt = source.originalCreatedAt;
    }
    if (editFormVersion == null && typeof source.editFormVersion === 'number') {
      editFormVersion = source.editFormVersion;
    }
  }
  return { editCalculationId, originalCreatedAt, editFormVersion };
}

export function serializeFieldValues(values: Record<string, string> | undefined): string {
  const normalized: Record<string, string> = {};
  for (const key of Object.keys(values ?? {}).sort()) {
    const value = values?.[key]?.trim() ?? '';
    if (value) normalized[key] = value;
  }
  return JSON.stringify(normalized);
}

export function fieldValuesEqual(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  return serializeFieldValues(a) === serializeFieldValues(b);
}

function structureLineSignature(line: StructureLine) {
  return {
    id: line.id,
    structureId: line.structureId,
    name: line.name,
    quantity: line.quantity,
    unit: line.unit ?? '',
    unitPriceVat0: line.unitPriceVat0,
    materialsVat0: line.materialsVat0,
    discountPercent: line.discountPercent,
    formFilled: Boolean(line.formFilled),
    fieldValues: serializeFieldValues(line.fieldValues),
    pricesIncludeVat: line.pricesIncludeVat !== false,
  };
}

/** Vertaa laskennan sisältöä tallennettuun tilaan (ei updatedAt). */
export function composerStateSignature(state: WizardFormState): string {
  return JSON.stringify({
    customerId: state.customerId ?? '',
    customerName: state.customerName.trim(),
    customerType: state.customerType,
    reverseVat: Boolean(state.reverseVat),
    customerPhone: state.customerPhone.trim(),
    customerEmail: state.customerEmail.trim(),
    customerAddress: state.customerAddress.trim(),
    customerPostalCode: (state.customerPostalCode ?? '').trim(),
    customerPostalLocality: (state.customerPostalLocality ?? '').trim(),
    customerNotes: state.customerNotes.trim(),
    deliveryScheduleText: (state.deliveryScheduleText ?? '').trim(),
    structureLines: (state.structureLines ?? []).map(structureLineSignature),
  });
}

export function hasWizardDraftContent(state: WizardFormState): boolean {
  return (
    state.step > 0 ||
    state.customerName.trim().length > 0 ||
    state.customerPhone.trim().length > 0 ||
    state.customerEmail.trim().length > 0 ||
    state.customerAddress.trim().length > 0 ||
    state.customerPostalCode.trim().length > 0 ||
    state.customerPostalLocality.trim().length > 0 ||
    state.customerNotes.trim().length > 0 ||
    state.duration.trim().length > 0 ||
    hasFieldValueContent(state.fieldValues) ||
    state.lines.length > 0 ||
    Boolean(state.customerId) ||
    Boolean(state.deliveryScheduleText?.trim()) ||
    (state.structureLines?.length ?? 0) > 0
  );
}

export function composerHasUnsavedChanges(
  state: WizardFormState,
  savedSignature: string | null,
): boolean {
  if (savedSignature == null) return hasWizardDraftContent(state);
  return composerStateSignature(state) !== savedSignature;
}

/**
 * Pidä kotisivun "Jatka laskentaa" -luonnos vain jos sessio oli jo kesken
 * tai sisältö eroaa avatusta valmiista laskelmasta / tyhjästä uudesta laskennasta.
 */
export function shouldKeepResumeDraftOnLeave(options: {
  resumedIncompleteDraft: boolean;
  currentSignature: string;
  originSignature: string | null;
}): boolean {
  if (options.resumedIncompleteDraft) return true;
  if (options.originSignature == null) return false;
  return options.currentSignature !== options.originSignature;
}

export function buildPersistedWizardDraft(
  state: WizardFormState,
  edit?: WizardDraftEditMeta | null,
  previous?: PersistedWizardDraft | WizardDraftEditMeta | null,
): PersistedWizardDraft {
  const merged = mergeWizardDraftEditMeta(edit, previous);
  const editCalculationId = firstNonEmptyId(merged.editCalculationId);
  const createdAt = merged.originalCreatedAt;
  const createdAtMs =
    createdAt instanceof Date
      ? createdAt.getTime()
      : typeof createdAt === 'number' && Number.isFinite(createdAt)
        ? createdAt
        : undefined;
  const editFormVersion =
    typeof merged.editFormVersion === 'number' ? merged.editFormVersion : undefined;

  return {
    step: state.step,
    customerName: state.customerName,
    customerType: state.customerType,
    reverseVat: state.reverseVat,
    customerPhone: state.customerPhone,
    customerEmail: state.customerEmail,
    customerAddress: state.customerAddress,
    customerPostalCode: state.customerPostalCode,
    customerPostalLocality: state.customerPostalLocality,
    customerNotes: state.customerNotes,
    duration: state.duration,
    fieldValues: state.fieldValues,
    lines: state.lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    })),
    updatedAt: Date.now(),
    ...(editCalculationId ? { editCalculationId } : {}),
    ...(createdAtMs != null ? { originalCreatedAt: createdAtMs } : {}),
    ...(editFormVersion != null ? { editFormVersion } : {}),
    ...(state.customerId ? { customerId: state.customerId } : {}),
    ...(state.deliveryScheduleText != null
      ? { deliveryScheduleText: state.deliveryScheduleText }
      : {}),
    ...(state.structureLines ? { structureLines: state.structureLines } : {}),
  };
}

export function hydrateWizardLines(
  persistedLines: PersistedWizardDraft['lines'],
  products: Product[],
): WizardLineDraft[] {
  return persistedLines
    .map((line) => {
      const product = products.find((item) => item.id === line.productId);
      if (!product) return null;
      return { product, quantity: line.quantity };
    })
    .filter((line): line is WizardLineDraft => line !== null);
}

export function persistedDraftToFormState(
  draft: PersistedWizardDraft,
  products: Product[],
): { form: WizardFormState; wizardDraft: WizardDraft } {
  const lines = hydrateWizardLines(draft.lines, products);
  const fieldValues = {
    ...(draft.fieldValues ?? {}),
    ...(draft.duration.trim() && !draft.fieldValues?.tyoryhma_kesto_pv
      ? { tyoryhma_kesto_pv: draft.duration }
      : {}),
  };
  const form: WizardFormState = {
    step: draft.step,
    customerName: draft.customerName,
    customerType: draft.customerType ?? 'private',
    reverseVat: draft.reverseVat ?? false,
    customerPhone: draft.customerPhone,
    customerEmail: draft.customerEmail,
    customerAddress: draft.customerAddress,
    customerPostalCode: draft.customerPostalCode ?? '',
    customerPostalLocality: draft.customerPostalLocality ?? '',
    customerNotes: draft.customerNotes,
    duration: draft.duration,
    fieldValues,
    lines,
    customerId: draft.customerId,
    deliveryScheduleText: draft.deliveryScheduleText ?? '',
    structureLines: draft.structureLines,
  };
  const wizardDraft: WizardDraft = {
    customer: {
      ...emptyCustomerInfo(),
      name: draft.customerName,
      customerType: draft.customerType ?? 'private',
      reverseVat: draft.reverseVat ?? false,
      phone: draft.customerPhone || undefined,
      email: draft.customerEmail || undefined,
      address: draft.customerAddress || undefined,
      postalCode: draft.customerPostalCode || undefined,
      postalLocality: draft.customerPostalLocality || undefined,
      notes: draft.customerNotes || undefined,
    },
    lines,
  };
  return { form, wizardDraft };
}
