import type {
  PersistedWizardDraft,
  Product,
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
  customerNotes: string;
  duration: string;
  fieldValues: Record<string, string>;
  lines: WizardLineDraft[];
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

export function hasWizardDraftContent(state: WizardFormState): boolean {
  return (
    state.step > 0 ||
    state.customerName.trim().length > 0 ||
    state.customerPhone.trim().length > 0 ||
    state.customerEmail.trim().length > 0 ||
    state.customerAddress.trim().length > 0 ||
    state.customerNotes.trim().length > 0 ||
    state.duration.trim().length > 0 ||
    hasFieldValueContent(state.fieldValues) ||
    state.lines.length > 0
  );
}

export function buildPersistedWizardDraft(
  state: WizardFormState,
  edit?: WizardDraftEditMeta | null,
): PersistedWizardDraft {
  const editCalculationId = firstNonEmptyId(edit?.editCalculationId);
  const createdAt = edit?.originalCreatedAt;
  const createdAtMs =
    createdAt instanceof Date
      ? createdAt.getTime()
      : typeof createdAt === 'number' && Number.isFinite(createdAt)
        ? createdAt
        : undefined;
  const editFormVersion =
    typeof edit?.editFormVersion === 'number' ? edit.editFormVersion : undefined;

  return {
    step: state.step,
    customerName: state.customerName,
    customerType: state.customerType,
    reverseVat: state.reverseVat,
    customerPhone: state.customerPhone,
    customerEmail: state.customerEmail,
    customerAddress: state.customerAddress,
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
    customerNotes: draft.customerNotes,
    duration: draft.duration,
    fieldValues,
    lines,
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
      notes: draft.customerNotes || undefined,
    },
    lines,
  };
  return { form, wizardDraft };
}
