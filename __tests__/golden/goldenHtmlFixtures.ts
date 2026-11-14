import { sanitizeMaterialQuantities } from '../../src/core/materials/materialQuantities';
import type { CalculationRecord, MaterialQuantityRow, Product } from '../../src/core/models/types';
import type { BuildPdfContextInput } from '../../src/core/pdf/buildPdfContext';
import { defaultOfferCompanySettings } from '../../src/core/pdf/defaultOfferSettings';
import type { BuildUrakkakorttiInput } from '../../src/core/pdf/urakkakortti';

import { input, line, record } from '../pdfFixtures';

/** Kiinteä kellonaika golden-HTML-testeille (10.10.2026 klo 12:00 paikallista). */
export const GOLDEN_FIXED_DATE = new Date(2026, 9, 10, 12, 0, 0, 0);

export const GOLDEN_LOGO = 'data:image/png;base64,AAAA';

const goldenMaterialQuantities: MaterialQuantityRow[] = [
  {
    id: 'mq_paint',
    productName: 'Nova 7',
    quantity: 0,
    source: 'manual',
    productId: 'p_nova',
    shades: [
      { id: 'sh_g47', name: 'G47', quantity: 3, unit: 'l' },
      { id: 'sh_505x', name: '505X', quantity: 5, unit: 'l' },
      { id: 'sh_ncs', name: 'NCS S 0500-N', quantity: 2, unit: 'l' },
    ],
  },
  {
    id: 'mq_brush',
    productName: 'Pensseli 100mm',
    quantity: 2,
    unit: 'kpl',
    source: 'manual',
    productId: 'p_brush',
  },
];

export const goldenProducts: Product[] = [
  {
    id: 'p_nova',
    name: 'Nova 7',
    unit: 'l',
    unitPriceVat0: 45,
    purchasePriceVat0: 40,
    salePriceVat0: 45,
    structureIds: ['s1', 's2'],
    sortOrder: 0,
    createdAt: GOLDEN_FIXED_DATE,
  },
  {
    id: 'p_brush',
    name: 'Pensseli 100mm',
    unit: 'kpl',
    unitPriceVat0: 12,
    purchasePriceVat0: 10,
    salePriceVat0: 12,
    structureIds: ['s1'],
    sortOrder: 1,
    createdAt: GOLDEN_FIXED_DATE,
  },
];

function goldenCalculationRecord(): CalculationRecord {
  const materials = sanitizeMaterialQuantities(goldenMaterialQuantities) ?? [];
  return record(
    {
      address: 'Kultatie 7',
      postalCode: '33100',
      postalLocality: 'Tampere',
      phone: '040 111 2222',
    },
    {
      projectName: 'Fiktiivinen Kohde Oy',
      deliveryScheduleText: 'Viikolla 42/2026',
      structureLines: [
        {
          ...line('l_golden_a', 's1', 'Ulkomaalaus', '145'),
          additionalInfo: 'Golden-testi: telineet ja suojaukset mukana.',
          materialQuantities: materials,
        },
        {
          ...line('l_golden_b', 's2', 'Sokkeli', '38'),
          contractPriceVat0: 520,
          workDurationDays: 2,
        },
      ],
      lines: [
        {
          id: 'line_p1',
          productId: 'p_nova',
          productName: 'Nova 7',
          unit: 'l',
          unitPriceVat0: 45,
          quantity: 10,
          lineTotalVat0: 450,
        },
        {
          id: 'line_p2',
          productId: 'p_brush',
          productName: 'Pensseli 100mm',
          unit: 'kpl',
          unitPriceVat0: 12,
          quantity: 3,
          lineTotalVat0: 36,
        },
      ],
      totalPriceVat0: 2520,
      totalPriceVat: 3161.4,
      vatAmount: 641.4,
      contractPriceVat0: 2520,
      materialsVat0: 486,
      createdAt: new Date(2026, 9, 1, 8, 30, 0, 0),
    },
  );
}

export function buildGoldenPdfContextInput(): BuildPdfContextInput {
  const rec = goldenCalculationRecord();
  return input(rec, {
    products: goldenProducts,
    generatedAt: GOLDEN_FIXED_DATE,
    offerNumber: 10420,
    offerCompany: {
      ...defaultOfferCompanySettings,
      additionalInfoText: 'Fiktiivinen maksuehto golden-HTML-testiin. Ei oikeaa sopimusta.',
    },
    offerStructureSettings: {
      s1: { additionalInfoText: '', offerPages: [] },
      s2: { additionalInfoText: '', offerPages: [] },
    },
  });
}

export function buildGoldenUrakkakorttiInput(): BuildUrakkakorttiInput {
  const rec = goldenCalculationRecord();
  const base = buildGoldenPdfContextInput();
  return {
    record: rec,
    company: base.company,
    structures: base.structures,
    products: base.products,
    settings: base.settings,
    generatedAt: GOLDEN_FIXED_DATE,
    offerStructureSettings: base.offerStructureSettings,
  };
}
