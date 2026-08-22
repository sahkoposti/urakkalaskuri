import {
  DEFAULT_WIZARD_STEP_ORDER,
  type WizardStepId,
} from '@/src/core/models/types';

export function normalizeWizardStepOrder(order: WizardStepId[]): WizardStepId[] {
  const valid = order.filter((stepId) => DEFAULT_WIZARD_STEP_ORDER.includes(stepId));
  const missing = DEFAULT_WIZARD_STEP_ORDER.filter((stepId) => !valid.includes(stepId));
  return [...valid, ...missing];
}

export function moveWizardStep(
  order: WizardStepId[],
  index: number,
  direction: -1 | 1,
): WizardStepId[] {
  const next = [...order];
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= next.length) {
    return next;
  }
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}
