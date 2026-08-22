import type {
  FieldValue,
  FormDefinition,
} from '@/src/core/form/types';
import { DURATION_DAYS_KEY } from '@/src/core/form/types';
import { hasFieldContent } from '@/src/core/form/fieldValues';
import type {
  PersistedWizardDraft,
  Product,
  WizardDraft,
  WizardLineDraft,
} from '@/src/core/models/types';
import { emptyCustomerInfo } from '@/src/core/models/types';
import { parseNumber } from '@/src/core/utils/formatters';

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
  lines: WizardLineDraft[];
  fieldValues: Record<string, FieldValue>;
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
    state.lines.length > 0 ||
    hasFieldContent(state.fieldValues)
  );
}

export function buildPersistedWizardDraft(
  state: WizardFormState,
  form?: FormDefinition,
): PersistedWizardDraft {
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
    lines: state.lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
    })),
    fieldValues: state.fieldValues as Record<string, unknown>,
    formId: form?.id,
    formUpdatedAt: form?.updatedAt,
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

function fieldValuesFromDraft(draft: PersistedWizardDraft): Record<string, FieldValue> {
  const values = { ...(draft.fieldValues as Record<string, FieldValue> | undefined) };
  if (values[DURATION_DAYS_KEY] == null && draft.duration.trim()) {
    const parsed = parseNumber(draft.duration);
    if (parsed !== null) values[DURATION_DAYS_KEY] = parsed;
  }
  return values;
}

export function persistedDraftToFormState(
  draft: PersistedWizardDraft,
  products: Product[],
): { form: WizardFormState; wizardDraft: WizardDraft } {
  const lines = hydrateWizardLines(draft.lines, products);
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
    lines,
    fieldValues: fieldValuesFromDraft(draft),
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
