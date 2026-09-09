import type { Href } from 'expo-router';

import { firstNonEmptyId } from '@/src/core/wizard/wizardDraftHelpers';

export function parseStructureIdParam(param?: string | string[]): string | undefined {
  return firstNonEmptyId(param);
}

export function calculationSettingsHref(path: string, structureId: string): Href {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}structureId=${encodeURIComponent(structureId)}` as Href;
}
