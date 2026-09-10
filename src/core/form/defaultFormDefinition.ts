import julkisivumaalausV100 from '../../../docs/examples/julkisivumaalaus_v100.json';
import type { FormDefinition } from '@/src/core/form/types';

/** Pieni Peruslaskenta-lomake testeille. Tuotannon oletus on createDefaultFormDefinition(). */
export function createMinimalFormDefinition(): FormDefinition {
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
      id: 'page_surfaces',
      title: 'Pinta-alat',
      sortOrder: 0,
      fieldIds: [
        'field_kiintea_seinapinta',
        'field_aukkovahennykset',
        'field_laudoitustyyppi',
        'field_laskenta_seinapinta',
      ],
    },
    {
      id: 'page_duration',
      title: 'Työn kesto (pv)',
      sortOrder: 1,
      fieldIds: ['field_system_tyoryhma_kesto_pv', 'field_system_alennus_prosentti'],
    },
    {
      id: 'page_prices',
      title: 'Hinnat',
      sortOrder: 2,
      fieldIds: [
        'field_system_urakka',
        'field_system_materiaalit',
        'field_system_myyntipalkkio',
        'field_system_kokonaishinta_alv0',
        'field_system_kokonaishinta',
      ],
    },
  ];

  return {
    id: 'default',
    name: 'Peruslaskenta',
    version: 8,
    pages,
    fields: userFields,
    updatedAt: Date.now(),
  };
}

/** Oletuslomake (Julkisivumaalaus v111). */
export function createDefaultFormDefinition(): FormDefinition {
  return JSON.parse(JSON.stringify(julkisivumaalausV100)) as FormDefinition;
}
