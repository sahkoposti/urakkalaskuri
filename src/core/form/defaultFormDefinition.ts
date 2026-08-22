import type { FormDefinition, FormField } from '@/src/core/form/types';
import { DURATION_DAYS_KEY } from '@/src/core/form/types';

function durationField(pageId: string): FormField {
  return {
    id: 'field_duration',
    pageId,
    key: DURATION_DAYS_KEY,
    label: 'Kesto',
    type: 'number',
    sortOrder: 0,
    required: true,
    showOnSummary: true,
    unit: 'pv',
    debugExampleValue: '5',
  };
}

/** v1-yhteensopiva oletuspohja: asiakas, kesto, materiaalit */
export function createDefaultFormDefinition(): FormDefinition {
  const pages = [
    { id: 'page_customer', title: 'Asiakas', sortOrder: 0, system: 'customer' as const },
    { id: 'page_duration', title: 'Työryhmän arvioitu kesto (pv)', sortOrder: 1 },
    { id: 'page_materials', title: 'Materiaalit', sortOrder: 2, system: 'materials' as const },
  ];

  return {
    id: 'default',
    name: 'Peruslaskenta',
    version: 1,
    pages,
    fields: [durationField('page_duration')],
    updatedAt: Date.now(),
  };
}

/** Testi- ja debug-pohja pinta-alakaavalle (PDF-esimerkki 117,30 m²) */
export function createSurfaceExampleForm(): FormDefinition {
  return {
    id: 'surface-example',
    name: 'Pinta-alaesimerkki',
    version: 1,
    updatedAt: Date.now(),
    pages: [
      { id: 'page_surfaces', title: 'Pinta-alat', sortOrder: 0 },
      { id: 'page_duration', title: 'Kesto', sortOrder: 1 },
    ],
    fields: [
      {
        id: 'field_kiinteä_seinäpinta',
        pageId: 'page_surfaces',
        key: 'kiinteä_seinäpinta_ala_m2',
        label: 'Kiinteä seinäpinta-ala',
        type: 'number',
        sortOrder: 0,
        required: true,
        showOnSummary: true,
        unit: 'm²',
        debugExampleValue: '120',
      },
      {
        id: 'field_aukkovähennykset',
        pageId: 'page_surfaces',
        key: 'aukkovähennykset',
        label: 'Aukkovähennykset',
        type: 'number',
        sortOrder: 1,
        required: false,
        showOnSummary: true,
        unit: 'm²',
        debugExampleValue: '18',
      },
      {
        id: 'field_laudoitustyyppi',
        pageId: 'page_surfaces',
        key: 'laudoitustyyppi',
        label: 'Laudoitustyyppi',
        type: 'select',
        sortOrder: 2,
        required: true,
        showOnSummary: true,
        debugExampleValue: 'paneeli',
        options: [
          { label: 'Paneeli', value: 'paneeli', multiplier: 1.15, exportKey: 'laudoituskerroin' },
          { label: 'Lomalaudoitus', value: 'lomalaudoitus', multiplier: 1.25, exportKey: 'laudoituskerroin' },
          { label: 'Rimalaudoitus', value: 'rimalaudoitus', multiplier: 1.3, exportKey: 'laudoituskerroin' },
          { label: 'Hirsi', value: 'hirsi', multiplier: 1.0, exportKey: 'laudoituskerroin' },
        ],
      },
      {
        id: 'field_laskenta_seinäpinta',
        pageId: 'page_surfaces',
        key: 'laskenta_seinäpinta_ala_m2',
        label: 'Seinäpinta-ala (laskettu)',
        type: 'computed',
        sortOrder: 3,
        required: false,
        showOnSummary: true,
        unit: 'm²',
        formula: '(kiinteä_seinäpinta_ala_m2 - aukkovähennykset) * laudoituskerroin',
      },
      durationField('page_duration'),
    ],
  };
}
