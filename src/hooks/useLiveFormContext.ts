import { useEffect, useState } from 'react';

import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import type { FormDefinition } from '@/src/core/form/types';
import type { AppSettings, Product, WizardLineDraft } from '@/src/core/models/types';

/** Näppäin ehtii piirtyä ennen kaavalaskentaa; peräkkäiset merkit yhdistetään. */
export const LIVE_FORM_CONTEXT_DEBOUNCE_MS = 50;

type LiveFormContextInput = {
  form: FormDefinition;
  fieldValues: Record<string, string>;
  materialLines: WizardLineDraft[];
  products: Product[];
  settings: AppSettings;
  legacyDuration?: string;
};

export function useLiveFormContext({
  form,
  fieldValues,
  materialLines,
  products,
  settings,
  legacyDuration,
}: LiveFormContextInput): Record<string, number> {
  const [computedValues, setComputedValues] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setComputedValues(
        previewFormContext(form, fieldValues, materialLines, products, settings, legacyDuration),
      );
    }, LIVE_FORM_CONTEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [form, fieldValues, materialLines, products, settings, legacyDuration]);

  return computedValues;
}
