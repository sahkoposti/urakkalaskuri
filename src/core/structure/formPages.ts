import { wizardFieldsForPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import type { FormDefinition, FormPage } from '@/src/core/form/types';
import type { StructureLine } from '@/src/core/models/types';
import { isManualStructureId, type ProductStructure } from '@/src/core/structure/types';

/** Rivin lomake: ei materiaalivaihetta, ei tyhjiä sivuja (esim. Asiakas ilman lisäkenttiä). */
export function structureFormPages(form: FormDefinition): FormPage[] {
  return sortedPages(form).filter((page) => {
    if (page.system === 'materials') return false;
    return wizardFieldsForPage(form, page.id).length > 0;
  });
}

export function hasStructureFormPages(form: FormDefinition): boolean {
  return structureFormPages(form).length > 0;
}

export function isStructureFormIncomplete(
  line: Pick<StructureLine, 'formFilled' | 'structureId'>,
  structure?: Pick<ProductStructure, 'form'> | null,
): boolean {
  if (isManualStructureId(line.structureId)) return false;
  if (!structure || !hasStructureFormPages(structure.form)) return false;
  return !line.formFilled;
}
