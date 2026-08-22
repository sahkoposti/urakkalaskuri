import type { FormDefinition } from '@/src/core/form/types';

/** v1 wizard + esimerkkikentät modulaarisen laskennan debuggausta varten */
export function createDefaultFormDefinition(): FormDefinition {
  const pages = [
    { id: 'page_customer', title: 'Asiakas', sortOrder: 0, system: 'customer' as const },
    { id: 'page_surfaces', title: 'Pinta-alat', sortOrder: 1 },
    { id: 'page_duration', title: 'Työryhmän arvioitu kesto (pv)', sortOrder: 2 },
    { id: 'page_materials', title: 'Materiaalit', sortOrder: 3, system: 'materials' as const },
  ];

  const fields = [
    {
      id: 'field_kiinteä_seinäpinta',
      pageId: 'page_surfaces',
      key: 'kiinteä_seinäpinta_ala_m2',
      label: 'Kiinteä seinäpinta-ala',
      type: 'number' as const,
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
      type: 'number' as const,
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
      type: 'select' as const,
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
      type: 'computed' as const,
      sortOrder: 3,
      required: false,
      showOnSummary: true,
      unit: 'm²',
      formula: '(kiinteä_seinäpinta_ala_m2 - aukkovähennykset) * laudoituskerroin',
    },
    {
      id: 'field_duration',
      pageId: 'page_duration',
      key: 'työryhmän_kesto_pv',
      label: 'Kesto',
      type: 'number' as const,
      sortOrder: 0,
      required: true,
      showOnSummary: true,
      unit: 'pv',
      debugExampleValue: '5',
    },
  ];

  return {
    id: 'default',
    name: 'Peruslaskenta',
    version: 1,
    pages,
    fields,
    updatedAt: Date.now(),
  };
}
