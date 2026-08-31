import type { FormDefinition } from '@/src/core/form/types';

/** Oletuslomake (Peruslaskenta) – esimerkkikentät modulaarisen laskennan debuggausta varten */
export function createDefaultFormDefinition(): FormDefinition {
  const userFields = [
    {
      id: 'field_kiintea_seinapinta',
      key: 'kiintea_seinapinta_ala_m2',
      label: 'Kiinteä seinäpinta-ala',
      type: 'number' as const,
      required: true,
      showOnSummary: true,
      unit: 'm²',
      debugExampleValue: '120',
    },
    {
      id: 'field_aukkovahennykset',
      key: 'aukkovahennykset',
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
      debugExampleValue: '1.15',
      options: [
        { label: 'Paneeli', value: '1.15' },
        { label: 'Lomalaudoitus', value: '1.25' },
        { label: 'Rimalaudoitus', value: '1.3' },
        { label: 'Hirsi', value: '1' },
      ],
    },
    {
      id: 'field_laskenta_seinapinta',
      key: 'laskenta_seinapinta_ala_m2',
      label: 'Seinäpinta-ala (laskettu)',
      type: 'computed' as const,
      required: false,
      showOnSummary: true,
      allowManualOverride: true,
      unit: 'm²',
      formula: '(kiintea_seinapinta_ala_m2 - aukkovahennykset) * laudoitustyyppi',
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
        'field_kiintea_seinapinta',
        'field_aukkovahennykset',
        'field_laudoitustyyppi',
        'field_laskenta_seinapinta',
      ],
    },
    {
      id: 'page_materials',
      title: 'Materiaalit',
      sortOrder: 2,
      system: 'materials' as const,
      fieldIds: [] as string[],
    },
    {
      id: 'page_duration',
      title: 'Työryhmän arvioitu kesto (pv)',
      sortOrder: 3,
      fieldIds: ['field_system_tyoryhma_kesto_pv'],
    },
  ];

  return {
    id: 'default',
    name: 'Peruslaskenta',
    version: 6,
    pages,
    fields: userFields,
    updatedAt: Date.now(),
  };
}
