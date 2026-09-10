import type { FormField } from '@/src/core/form/types';

export function fieldJoinsPreviousRow(field: FormField): boolean {
  return field.type !== 'section' && field.sameRowAsPrevious === true;
}

/**
 * Ryhmittelee wizardin näkyvät kentät riveiksi.
 * `sameRowAsPrevious` liittää kentän edelliseen riviin; peräkkäiset liitokset
 * jakavat saman rivin (2 → 50/50, 3 → ⅓, …). Otsikko ei jaa riviä.
 */
export function groupFieldsIntoRows(fields: FormField[]): FormField[][] {
  const rows: FormField[][] = [];
  for (const field of fields) {
    const last = rows[rows.length - 1];
    const lastAcceptsJoin = Boolean(last?.length) && last![0]!.type !== 'section';
    if (fieldJoinsPreviousRow(field) && lastAcceptsJoin) {
      last!.push(field);
    } else {
      rows.push([field]);
    }
  }
  return rows;
}
