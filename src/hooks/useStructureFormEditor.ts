import { useLocalSearchParams } from 'expo-router';

import { calculationSettingsHref, parseStructureIdParam } from '@/src/core/navigation/calculationSettings';
import type { FormDefinition } from '@/src/core/form/types';
import { db, useApp } from '@/src/context/AppContext';

export function useStructureFormEditor() {
  const { structureId: rawStructureId } = useLocalSearchParams<{
    structureId?: string | string[];
  }>();
  const { structures, activeStructureId, refreshFormSettings, refreshStructures } = useApp();
  const structureId = parseStructureIdParam(rawStructureId) ?? activeStructureId;
  const structure = structures.find((item) => item.id === structureId);
  const formDefinition = structure?.form;

  async function persistForm(
    form: FormDefinition,
    options?: { preserveVersion?: boolean },
  ): Promise<void> {
    await db.saveFormDefinition(form, { ...options, structureId });
    await refreshStructures();
    await refreshFormSettings();
  }

  function href(path: string) {
    return calculationSettingsHref(path, structureId);
  }

  return {
    structureId,
    structure,
    formDefinition,
    persistForm,
    href,
  };
}
