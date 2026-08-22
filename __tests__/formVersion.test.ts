import {
  bumpFormVersion,
  formVersionMismatchFromRecord,
  formVersionMismatchMessage,
  hasFormVersionMismatch,
} from '../src/core/form/formVersion';
import type { FormDefinition } from '../src/core/form/types';
import type { CalculationRecord } from '../src/core/models/types';

const baseForm: Pick<FormDefinition, 'version'> = { version: 5 };

describe('formVersion', () => {
  test('bumpFormVersion increments finite versions', () => {
    expect(bumpFormVersion({ version: 5 } as FormDefinition).version).toBe(6);
    expect(bumpFormVersion({ version: 0 } as FormDefinition).version).toBe(1);
  });

  test('hasFormVersionMismatch compares snapshot to current', () => {
    expect(hasFormVersionMismatch(5, 5)).toBe(false);
    expect(hasFormVersionMismatch(4, 5)).toBe(true);
    expect(hasFormVersionMismatch(undefined, 5)).toBe(false);
    expect(hasFormVersionMismatch(null, 5)).toBe(false);
  });

  test('formVersionMismatchFromRecord uses snapshot formVersion', () => {
    const matching: Pick<CalculationRecord, 'formSnapshot'> = {
      formSnapshot: {
        formId: 'default',
        formVersion: 5,
        fields: [],
      },
    };
    const outdated: Pick<CalculationRecord, 'formSnapshot'> = {
      formSnapshot: {
        formId: 'default',
        formVersion: 3,
        fields: [],
      },
    };
    expect(formVersionMismatchFromRecord(matching, baseForm)).toBe(false);
    expect(formVersionMismatchFromRecord(outdated, baseForm)).toBe(true);
    expect(formVersionMismatchFromRecord({}, baseForm)).toBe(false);
    expect(formVersionMismatchFromRecord(null, baseForm)).toBe(false);
  });

  test('formVersionMismatchMessage is Finnish and includes versions', () => {
    const message = formVersionMismatchMessage(3, 5);
    expect(message).toContain('versio 3 → 5');
    expect(message).toContain('Lomakepohjaa on muutettu');
  });
});
