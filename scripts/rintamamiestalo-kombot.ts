/**
 * Laskee rintamamiestalon julkisivumaalauksen hinnat kaikilla pyydetyillä
 * lomakekomboilla (Julkisivumaalaus v100) ja kirjoittaa listan hintajärjestykseen.
 *
 * Ajo projektin juuresta: npm run kombot
 */
import fs from 'node:fs';
import path from 'node:path';

import { runFormCalculation } from '../src/core/calculation/calculationPipeline';
import { normalizeFormDefinition } from '../src/core/form/formDefinitionHelpers';
import { defaultSettings, type Product } from '../src/core/models/types';
import { formatCurrency, formatDecimal } from '../src/core/utils/formatters';

const ROOT = process.cwd();
const FORM_PATH = path.join(ROOT, 'docs', 'examples', 'julkisivumaalaus_v100.json');
const OUT_MD = path.join(ROOT, 'docs', 'examples', 'rintamamiestalo-kombot.md');
const OUT_CSV = path.join(ROOT, 'docs', 'examples', 'rintamamiestalo-kombot.csv');

const PAINT_ID = 'maali-9eur';
export const PAINT_PRODUCT: Product = {
  id: PAINT_ID,
  name: 'Maali 9 €/l',
  unit: 'l',
  unitPriceVat0: 9,
  purchasePriceVat0: 9,
  attributes: { consumption: 7, work_factor: 1 },
  createdAt: new Date(),
};

const LAUDOITUKSET = [
  { label: 'Panelointi', value: '1' },
  { label: 'Lomalaudoitus', value: '1.25' },
  { label: 'Rimalaudoitus', value: '1.075' },
] as const;

const RAYSTASTYYPIT = [
  { label: 'Umpiräystäs', value: '1' },
  { label: 'Avoräystäs', value: '1.25' },
] as const;

const HOMEENESTOT = [
  { label: 'Homeenesto kyllä', value: true },
  { label: 'Homeenesto ei', value: false },
] as const;

const MAALINPOISTOT = [
  { label: 'Ei maalinpoistoa', on: false, vaativuus: '1', seinat: '0' },
  { label: 'Helppo, 2 seinää', on: true, vaativuus: '1', seinat: '2' },
  { label: 'Helppo, 4 seinää', on: true, vaativuus: '1', seinat: '4' },
  { label: 'Vaikea, 2 seinää', on: true, vaativuus: '1.5', seinat: '2' },
  { label: 'Vaikea, 4 seinää', on: true, vaativuus: '1.5', seinat: '4' },
] as const;

const POHJAMAALAUKSET = [
  { label: 'Ei pohjamaalausta', on: false, seinat: '0' },
  { label: 'Pohjamaalaus, 2 seinää', on: true, seinat: '2' },
  { label: 'Pohjamaalaus, 4 seinää', on: true, seinat: '4' },
] as const;

const MAASTOT = [
  { label: 'Tasainen', value: '1' },
  { label: 'Lievä rinne', value: '1.1' },
  { label: 'Haastava', value: '1.25' },
] as const;

const KORKEUDET = [
  { label: 'Keskitaso', value: '1' },
  { label: 'Korkea', value: '1.1' },
] as const;

const VARINVAIHDOT = [
  { label: 'Värinvaihto ei', value: false },
  { label: 'Värinvaihto kyllä', value: true },
] as const;

export type Combo = {
  laudoitus: (typeof LAUDOITUKSET)[number];
  raystas: (typeof RAYSTASTYYPIT)[number];
  homeenesto: (typeof HOMEENESTOT)[number];
  maalinpoisto: (typeof MAALINPOISTOT)[number];
  pohjamaalaus: (typeof POHJAMAALAUKSET)[number];
  maasto: (typeof MAASTOT)[number];
  korkeus: (typeof KORKEUDET)[number];
  varinvaihto: (typeof VARINVAIHDOT)[number];
};

type ComboResult = Combo & {
  totalVat: number;
  totalVat0: number;
  urakkaVat0: number;
  materiaalitVat0: number;
  materiaalitOstoVat0: number;
  seinapinta: number;
  maalitL: number;
  tyoH: number;
  kestoPv: number;
};

function bool(value: boolean): string {
  return value ? 'true' : 'false';
}

function baseFieldValues(): Record<string, string> {
  return {
    etaisyys: '0.25',
    julkisivupinnat_valinta: 'true',
    raystassivun_pituus_m: '10',
    raystaskorkeus_m: '4.5',
    paadyn_leveys_m: '8',
    harjakorkeus_m: '6.5',
    lisaseinien_lkm: '3',
    lisaseinien_pituus_m: '6',
    lisaseinien_keskikorkeus_m: '2.5',
    ikkunat_lkm: '11',
    ovet_lkm: '1',
    raystaanaluset_valinta: 'true',
    pieluslaudat_valinta: 'true',
    nurkkalaudat_valinta: 'true',
    listalaudat_valinta: 'true',
    alakatot_valinta: 'false',
    markahomepesu_valinta: 'true',
    maalaus_valinta: 'true',
    savyjen_lkm: '2',
    kaytettava_maali: PAINT_ID,
    ensimmainen_savy: 'Sävy 1',
    toinen_savy: 'Sävy 2',
    alennus_prosentti: '0',
    muut_kulut_alv0: '0',
    muu_tyo_tyoparin_kesto_h: '0',
  };
}

export function fieldValuesFor(combo: Combo): Record<string, string> {
  return {
    ...baseFieldValues(),
    laudoitustyyppi: combo.laudoitus.value,
    raystastyyppi: combo.raystas.value,
    homeenestokasittely_valinta: bool(combo.homeenesto.value),
    maalinpoisto_valinta: bool(combo.maalinpoisto.on),
    skrapauksen_vaativuus: combo.maalinpoisto.vaativuus,
    maalinpoisto_seinien_lkm: combo.maalinpoisto.seinat,
    pohjamaalaus_valinta: bool(combo.pohjamaalaus.on),
    pohjamaalaus_seinien_lkm: combo.pohjamaalaus.seinat,
    maaston_vaikeusaste: combo.maasto.value,
    kohteen_korkeuskerroin: combo.korkeus.value,
    varinvaihto_valinta: bool(combo.varinvaihto.value),
  };
}

export function allCombos(): Combo[] {
  const combos: Combo[] = [];
  for (const laudoitus of LAUDOITUKSET) {
    for (const raystas of RAYSTASTYYPIT) {
      for (const homeenesto of HOMEENESTOT) {
        for (const maalinpoisto of MAALINPOISTOT) {
          for (const pohjamaalaus of POHJAMAALAUKSET) {
            for (const maasto of MAASTOT) {
              for (const korkeus of KORKEUDET) {
                for (const varinvaihto of VARINVAIHDOT) {
                  combos.push({
                    laudoitus,
                    raystas,
                    homeenesto,
                    maalinpoisto,
                    pohjamaalaus,
                    maasto,
                    korkeus,
                    varinvaihto,
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  return combos;
}

function comboKey(row: Combo): string {
  return [
    row.laudoitus.label,
    row.raystas.label,
    row.homeenesto.label,
    row.maalinpoisto.label,
    row.pohjamaalaus.label,
    row.maasto.label,
    row.korkeus.label,
  ].join('|');
}

function varinvaihtoImpact(results: ComboResult[]): {
  pairs: number;
  avgHintaEur: number;
  avgHintaPct: number;
  avgUrakkaEur: number;
  avgUrakkaPct: number;
  medianUrakkaEur: number;
  minUrakkaEur: number;
  maxUrakkaEur: number;
  avgTyoH: number;
  avgTyoPct: number;
  medianTyoH: number;
  minTyoH: number;
  maxTyoH: number;
} {
  const byKey = new Map<string, { off?: ComboResult; on?: ComboResult }>();
  for (const row of results) {
    const rec = byKey.get(comboKey(row)) ?? {};
    if (row.varinvaihto.value) rec.on = row;
    else rec.off = row;
    byKey.set(comboKey(row), rec);
  }

  const hinta: number[] = [];
  const hintaPct: number[] = [];
  const urakka: number[] = [];
  const urakkaPct: number[] = [];
  const tyo: number[] = [];
  const tyoPct: number[] = [];
  for (const rec of byKey.values()) {
    if (!rec.off || !rec.on) continue;
    hinta.push(rec.on.totalVat - rec.off.totalVat);
    hintaPct.push(((rec.on.totalVat - rec.off.totalVat) / rec.off.totalVat) * 100);
    urakka.push(rec.on.urakkaVat0 - rec.off.urakkaVat0);
    urakkaPct.push(((rec.on.urakkaVat0 - rec.off.urakkaVat0) / rec.off.urakkaVat0) * 100);
    tyo.push(rec.on.tyoH - rec.off.tyoH);
    tyoPct.push(((rec.on.tyoH - rec.off.tyoH) / rec.off.tyoH) * 100);
  }

  urakka.sort((a, b) => a - b);
  tyo.sort((a, b) => a - b);
  const n = urakka.length;
  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    pairs: n,
    avgHintaEur: avg(hinta),
    avgHintaPct: avg(hintaPct),
    avgUrakkaEur: avg(urakka),
    avgUrakkaPct: avg(urakkaPct),
    medianUrakkaEur: urakka[Math.floor(n / 2)] ?? 0,
    minUrakkaEur: urakka[0] ?? 0,
    maxUrakkaEur: urakka[n - 1] ?? 0,
    avgTyoH: avg(tyo),
    avgTyoPct: avg(tyoPct),
    medianTyoH: tyo[Math.floor(n / 2)] ?? 0,
    minTyoH: tyo[0] ?? 0,
    maxTyoH: tyo[n - 1] ?? 0,
  };
}

function csvEscape(value: string): string {
  if (/[";\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function fiNumber(value: number, digits = 2): string {
  return value.toFixed(digits).replace('.', ',');
}

function writeOutputs(results: ComboResult[]): void {
  const csvHeader = [
    'sija',
    'hinta_sis_alv',
    'hinta_alv0',
    'urakkasumma_alv0',
    'materiaalit_osto_alv0',
    'materiaalit_alv0',
    'laudoitus',
    'raystas',
    'homeenesto',
    'maalinpoisto',
    'pohjamaalaus',
    'varinvaihto',
    'maasto',
    'korkeus',
    'seinapinta_m2',
    'maalit_l',
    'tyo_h',
    'kesto_pv',
  ];

  const csvLines = [
    csvHeader.join(';'),
    ...results.map((row, index) =>
      [
        index + 1,
        fiNumber(row.totalVat),
        fiNumber(row.totalVat0),
        fiNumber(row.urakkaVat0),
        fiNumber(row.materiaalitOstoVat0),
        fiNumber(row.materiaalitVat0),
        csvEscape(row.laudoitus.label),
        csvEscape(row.raystas.label),
        csvEscape(row.homeenesto.label.replace('Homeenesto ', '')),
        csvEscape(row.maalinpoisto.label),
        csvEscape(row.pohjamaalaus.label),
        csvEscape(row.varinvaihto.value ? 'kyllä' : 'ei'),
        csvEscape(row.maasto.label),
        csvEscape(row.korkeus.label),
        fiNumber(row.seinapinta),
        fiNumber(row.maalitL),
        fiNumber(row.tyoH),
        fiNumber(row.kestoPv),
      ].join(';'),
    ),
  ];

  const cheapest = results[0]!;
  const priciest = results[results.length - 1]!;
  const mid = results[Math.floor(results.length / 2)]!;
  const impact = varinvaihtoImpact(results);

  const mdLines = [
    '# Rintamamiestalon julkisivumaalaus – hintavertailu',
    '',
    `Lomake: **Julkisivumaalaus v104**. Yhteensä **${results.length}** kombinaatiota, halvin myyntihinta ensin.`,
    '',
    '## Kohde (kiinteä)',
    '',
    '- Räystässivu 10 m × 4,5 m, pääty 8 m leveä, harjakorkeus 6,5 m',
    '- 1 ovi, 11 ikkunaa',
    '- Lisäseinät 3 kpl, pituus 6 m yhteensä, keskikorkeus 2,5 m',
    '- Valittu: räystäänaluset, pieluslaudat, nurkkalaudat, listalaudat',
    '- Märkähomepesu kaikissa, maalaus kaikissa',
    '- Maali 9 €/l (ALV 0), menekki 7 m²/l, työkerroin 1, 2 sävyä',
    '- Matka 0,25 h / suunta',
    '- Sovelluksen oletusasetukset (tuntihinta 30 €, työryhmä 2, työpäivä 8 h, ALV 25,5 %, liukuva kate)',
    '',
    '## Vaihtuvat kombot',
    '',
    '- Laudoitus: panelointi, lomalaudoitus, rimalaudoitus',
    '- Räystäs: umpi / avo',
    '- Homeenestokäsittely: kyllä / ei',
    '- Maalinpoisto: ei / helppo 2 / helppo 4 / vaikea 2 / vaikea 4 seinää',
    '- Pohjamaalaus: ei / 2 seinää / 4 seinää',
    '- Värinvaihto: kyllä / ei',
    '- Maaston vaikeusaste: tasainen, lievä rinne, haastava',
    '- Kohteen korkeus: keskitaso, korkea',
    '',
    '## Yhteenveto',
    '',
    `| | Myyntihinta sis. ALV | Urakkasumma (ALV 0) | Kombinaatio |`,
    `|---|---|---|---|`,
    `| Halvin myyntihinta | ${formatCurrency(cheapest.totalVat)} | ${formatCurrency(cheapest.urakkaVat0)} | ${comboLabel(cheapest)} |`,
    `| Mediaani | ${formatCurrency(mid.totalVat)} | ${formatCurrency(mid.urakkaVat0)} | ${comboLabel(mid)} |`,
    `| Kallein myyntihinta | ${formatCurrency(priciest.totalVat)} | ${formatCurrency(priciest.urakkaVat0)} | ${comboLabel(priciest)} |`,
    '',
    `Värinvaihto lisää työn kestoa keskimäärin **${formatDecimal(impact.avgTyoH)} h** (${formatDecimal(impact.avgTyoPct)} %). Työntekijän urakkasumma nousee keskimäärin **${formatCurrency(impact.avgUrakkaEur)}** (${formatDecimal(impact.avgUrakkaPct)} %, vaihteluväli ${formatCurrency(impact.minUrakkaEur)}–${formatCurrency(impact.maxUrakkaEur)}). Myyntihintaan (sis. ALV) vaikutus on keskimäärin ${formatCurrency(impact.avgHintaEur)} (${formatDecimal(impact.avgHintaPct)} %).`,
    '',
    `Täysi taulukko CSV:nä: [rintamamiestalo-kombot.csv](./rintamamiestalo-kombot.csv)`,
    '',
    '## Kaikki kombot (halvin myyntihinta → kallein)',
    '',
    '| # | Sis. ALV | ALV 0 | Urakka ALV 0 | Laudoitus | Räystäs | Homeenesto | Maalinpoisto | Pohjamaalaus | Värinvaihto | Maasto | Korkeus | m² | Maalit l | Työ h |',
    '|---:|---:|---:|---:|---|---|---|---|---|---|---|---|---:|---:|---:|',
    ...results.map(
      (row, index) =>
        `| ${index + 1} | ${formatCurrency(row.totalVat)} | ${formatCurrency(row.totalVat0)} | ${formatCurrency(row.urakkaVat0)} | ${row.laudoitus.label} | ${row.raystas.label} | ${row.homeenesto.value ? 'Kyllä' : 'Ei'} | ${row.maalinpoisto.label} | ${row.pohjamaalaus.label} | ${row.varinvaihto.value ? 'Kyllä' : 'Ei'} | ${row.maasto.label} | ${row.korkeus.label} | ${formatDecimal(row.seinapinta)} | ${formatDecimal(row.maalitL)} | ${formatDecimal(row.tyoH)} |`,
    ),
    '',
  ];

  fs.writeFileSync(OUT_CSV, `${csvLines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(OUT_MD, `${mdLines.join('\n')}\n`, 'utf8');
}

function comboLabel(row: ComboResult): string {
  return [
    row.laudoitus.label,
    row.raystas.label,
    row.homeenesto.label,
    row.maalinpoisto.label,
    row.pohjamaalaus.label,
    row.varinvaihto.label,
    row.maasto.label,
    row.korkeus.label,
  ].join(' · ');
}

function main(): void {
  const form = normalizeFormDefinition(
    JSON.parse(fs.readFileSync(FORM_PATH, 'utf8')) as unknown,
  );
  const combos = allCombos();
  const results: ComboResult[] = [];

  for (const combo of combos) {
    const { context, result } = runFormCalculation({
      form,
      fieldValues: fieldValuesFor(combo),
      materialLines: [],
      products: [PAINT_PRODUCT],
      settings: defaultSettings,
    });

    results.push({
      ...combo,
      totalVat: result.totalPriceVat,
      totalVat0: result.totalPriceVat0,
      urakkaVat0: result.contractPriceVat0,
      materiaalitVat0: result.materialsVat0,
      materiaalitOstoVat0: context.materiaalit_osto_alv0 ?? result.materialsVat0,
      seinapinta: context.laskenta_seinapinta_ala_m2 ?? 0,
      maalitL: context.maalit_yhteensa_litraa ?? 0,
      tyoH: context.henkilotyotunnit ?? 0,
      kestoPv: context.tyoryhma_kesto_pv ?? result.workDurationDays,
    });
  }

  results.sort((a, b) => a.totalVat - b.totalVat || a.totalVat0 - b.totalVat0);
  writeOutputs(results);

  const cheapest = results[0]!;
  const mid = results[Math.floor(results.length / 2)]!;
  const priciest = results[results.length - 1]!;
  const impact = varinvaihtoImpact(results);
  const vat = 1 + defaultSettings.vatPercent / 100;
  function matSaleIncl(row: ComboResult): number {
    const suorat = row.urakkaVat0 + row.materiaalitVat0;
    return suorat > 0 ? row.materiaalitVat0 * (row.totalVat0 / suorat) * vat : 0;
  }
  console.log(`Laskettiin ${results.length} kombinaatiota.`);
  for (const [label, row] of [
    ['Halvin', cheapest],
    ['Mediaani', mid],
    ['Kallein', priciest],
  ] as const) {
    console.log(
      `${label}: myynti ${formatCurrency(row.totalVat)}, urakka ${formatCurrency(row.urakkaVat0)}, materiaalit osto ALV0 ${formatCurrency(row.materiaalitOstoVat0)}, materiaalit myynti sis ALV ${formatCurrency(matSaleIncl(row))}`,
    );
  }
  console.log(
    `Värinvaihto työhön: +${formatDecimal(impact.avgTyoH)} h (${formatDecimal(impact.avgTyoPct)} %), urakkasummaan: ${formatCurrency(impact.avgUrakkaEur)} (${formatDecimal(impact.avgUrakkaPct)} %), myyntihintaan: ${formatCurrency(impact.avgHintaEur)} (${formatDecimal(impact.avgHintaPct)} %)`,
  );
  console.log(`Kirjoitettu: ${path.relative(ROOT, OUT_MD)}`);
  console.log(`Kirjoitettu: ${path.relative(ROOT, OUT_CSV)}`);
}

if (process.argv[1]?.includes('rintamamiestalo-kombot')) {
  main();
}
