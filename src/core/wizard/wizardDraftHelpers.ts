import type {
  PersistedWizardDraft,
  Product,
  WizardDraft,
  WizardLineDraft,
} from '@/src/core/models/types';

export type WizardFormState = {
  step: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerNotes: string;
  duration: string;
  margin: string;
  commission: string;
  lines: WizardLineDraft[];
};

export function hasWizardDraftContent(state: WizardFormState): boolean {
  return (
    state.step > 0 ||
    state.customerName.trim().length > 0 ||
    state.customerPhone.trim().length > 0 ||
    state.customerEmail.trim().length > 0 ||
    state.customerAddress.trim().length > 0 ||
    state.customerNotes.trim().length > 0 ||
    state.duration.trim().length > 0 ||
    state.lines.length > 0
  );
}

export function buildPersistedWizardDraft(state: WizardFormState): PersistedWizardDraft {
  return {
    step: state.step,
    customerName: state.customerName,
    customerPhone: state.customerPhone,
    customerEmail: state.customerEmail,
    customerAddress: state.customerAddress,
    customerNotes: state.customerNotes,
    duration: state.duration,
    margin: state.margin,
    commission: state.commission,
    lines: state.lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    })),
    updatedAt: Date.now(),
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
  const form: WizardFormState = {
    step: draft.step,
    customerName: draft.customerName,
    customerPhone: draft.customerPhone,
    customerEmail: draft.customerEmail,
    customerAddress: draft.customerAddress,
    customerNotes: draft.customerNotes,
    duration: draft.duration,
    margin: draft.margin,
    commission: draft.commission,
    lines,
  };
  const wizardDraft: WizardDraft = {
    customer: {
      name: draft.customerName,
      phone: draft.customerPhone || undefined,
      email: draft.customerEmail || undefined,
      address: draft.customerAddress || undefined,
      notes: draft.customerNotes || undefined,
    },
    lines,
    marginPercent: Number.parseFloat(draft.margin.replace(',', '.')) || undefined,
    commissionPercent: Number.parseFloat(draft.commission.replace(',', '.')) || undefined,
  };
  return { form, wizardDraft };
}
