import type { FormDefinition } from '@/src/core/form/types';

/** v1 wizard + esimerkkikentät modulaarisen laskennan debuggausta varten */
export function createDefaultFormDefinition(): FormDefinition {
  const fields = [
    {
      id: 'field_kiinteä_seinäpinta',
      key: 'kiinteä_seinäpinta_ala_m2',
      label: 'Kiinteä seinäpinta-ala',
      type: 'number' as const,
      required: true,
      showOnSummary: true,
      unit: 'm²',
      debugExampleValue: '120',
    },
    {
      id: 'field_aukkovähennykset',
      key: 'aukkovähennykset',
      label: 'Aukkovähennykset',
      type: 'number' as const,
      required: false,
      showOnSummary: true,
      unit: 'm²',
      debugExampleValue: '18',
    },
    {
      id: 'field_laudoitustyyppi',
      key: 'laudoitustyyppi',
      label: 'Laudoitustyyppi',
      type: 'select' as const,
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
      key: 'laskenta_seinäpinta_ala_m2',
      label: 'Seinäpinta-ala (laskettu)',
      type: 'computed' as const,
      required: false,
      showOnSummary: true,
      allowManualOverride: true,
      unit: 'm²',
      formula: '(kiinteä_seinäpinta_ala_m2 - aukkovähennykset) * laudoituskerroin',
    },
    {
      id: 'field_duration',
      key: 'työryhmän_kesto_pv',
      label: 'Kesto',
      type: 'number' as const,
      required: true,
      showOnSummary: true,
      unit: 'pv',
      debugExampleValue: '5',
    },
  ];

  const pages = [
    {
      id: 'page_customer',
      title: 'Asiakas',
      sortOrder: 0,
      system: 'customer' as const,
      fieldIds: [] as string[],
    },
    {
      id: 'page_surfaces',
      title: 'Pinta-alat',
      sortOrder: 1,
      fieldIds: [
        'field_kiinteä_seinäpinta',
        'field_aukkovähennykset',
        'field_laudoitustyyppi',
        'field_laskenta_seinäpinta',
      ],
    },
    {
      id: 'page_duration',
      title: 'Työryhmän arvioitu kesto (pv)',
      sortOrder: 2,
      fieldIds: ['field_duration'],
    },
    {
      id: 'page_materials',
      title: 'Materiaalit',
      sortOrder: 3,
      system: 'materials' as const,
      fieldIds: [] as string[],
    },
  ];

  return {
    id: 'default',
    name: 'Peruslaskenta',
    version: 2,
    pages,
    fields,
    updatedAt: Date.now(),
  };
}
