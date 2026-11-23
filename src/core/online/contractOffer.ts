/**
 * Laskelma → palvelinsopimuksen (v0) tarjousluonnos. Puhdas funktio, ei verkkoa eikä tallennusta.
 * Summat lasketaan kokonaisluvuilla samoilla säännöillä kuin palvelin (contractMoney.ts).
 * Palvelin asettaa itse offer_number, version, status, sent_at, changed_at ja seller.user_id.
 * Lomakepohjien (laskurien) JSON ei muutu: tämä vain lukee tallennetun laskelman.
 */
import type { CalculationRecord, MaterialQuantityRow, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { clampDiscountPercent } from '@/src/core/calculation/discount';
import { structureLineQuantityIsZero } from '@/src/core/materials/structureLineQuantity';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { isManualStructureId } from '@/src/core/structure/types';
import { scaleByLineQuantity, scaleWorkDuration } from '@/src/core/structure/lineQuantityScale';
import { offerIncludesVat, isPrivateCustomer } from '@/src/core/utils/priceDisplay';
import { readKtvPageIncluded } from '@/src/core/pdf/ktvPageIncluded';
import { documentSiteAddress } from '@/src/core/pdf/siteAddress';
import { readOfferValidDays } from '@/src/core/pdf/offerValidDays';
import { validUntil } from '@/src/core/pdf/validUntil';
import {
  alihankkijaLineAmount,
  readUrakkakorttiMode,
  readUrakkakorttiRivihinnat,
} from '@/src/core/pdf/urakkakorttiCard';

import { bpOf, lineGrossBeforeDiscountCents, lineNetCents, scaledInt, vatCents, VAT_CODES, type VatCode } from './contractMoney';

export const CONTRACT_UNITS = ['m2', 'jm', 'kpl', 'h', 'pv', 'km', 'l', 'kg', 'era'] as const;
export type ContractUnit = (typeof CONTRACT_UNITS)[number];

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const UNIT_ALIASES: Record<string, ContractUnit> = {
  'm²': 'm2',
  m2: 'm2',
  litraa: 'l',
  litra: 'l',
  l: 'l',
  m: 'jm',
  jm: 'jm',
  'h (työpari)': 'h',
  h: 'h',
  kpl: 'kpl',
  pv: 'pv',
  km: 'km',
  kg: 'kg',
  erä: 'era',
  era: 'era',
};

/** Sovelluksen yksikköteksti → sopimuksen yksikkö. Tyhjä = kpl (Määrä on kappalemäärä). null = ei tunneta. */
export function contractUnit(text: string | undefined | null): ContractUnit | null {
  const key = (text ?? '').trim().toLowerCase();
  if (key === '') return 'kpl';
  return UNIT_ALIASES[key] ?? null;
}

export type ContractVatBreakdownRow = { vat_code: VatCode; vat_bp: number; net_cents: number; vat_cents: number };

export type ContractTotals = {
  net_cents: number;
  vat_cents: number;
  gross_cents: number;
  discount_cents: number;
  materials_cents: number;
  piece_rate_cents: number;
  margin_cents: number;
  hours_milli: number;
  commission_cents: number;
  vat_breakdown: ContractVatBreakdownRow[];
};

export type ContractLine = {
  line_id: string;
  line_no: number;
  structure_key: string;
  structure_name: string;
  description: string;
  kind: 'labour' | 'material' | 'travel' | 'other';
  qty_milli: number;
  unit: ContractUnit;
  unit_e4: number;
  discount_bp: number;
  net_cents: number;
  vat_code: VatCode;
  vat_bp: number;
  hours_milli: number;
  materials_cents: number;
  piece_rate_cents: number;
  margin_cents: number;
  commission_bp: number;
  spec: { key: string; label: string; value: string; unit?: string }[];
  materials: { product_id: string; name: string; qty_milli: number; unit: ContractUnit }[];
};

export type ContractOfferDraft = {
  offer_id: string;
  created_at: number;
  valid_until: string;
  seller: { name?: string };
  customer: {
    customer_id: string;
    kind: 'private' | 'company';
    name: string;
    reverse_charge_proposed: boolean;
    household_deduction_eligible: boolean;
    phone?: string;
    email?: string;
  };
  site: { site_id: string; address: string; postcode: string; city: string };
  vat_mode: 'normal' | 'reverse_charge';
  prices_shown: 'vat_included' | 'vat_excluded';
  job_card: { mode: 'alihankkija' | 'tyontekija' };
  schedule_wish?: { notes: string };
  commission_bp: number;
  lines: ContractLine[];
  totals: ContractTotals;
};

export type ContractProblem = { lineName?: string; message: string };

export type BuildContractInput = {
  record: CalculationRecord;
  workdayHours: number;
  /** Tarjouspäivä; voimassaolo lasketaan tästä. */
  now: Date;
  /** Yrityksen oletus voimassaolopäiville (Tarjous-asetukset). */
  companyOfferValidDays?: number;
  sellerName?: string;
};

export type BuildContractResult =
  | { ok: true; draft: ContractOfferDraft }
  | { ok: false; problems: ContractProblem[] };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Paikallinen kalenteripäivä YYYY-MM-DD (puhelimen aikavyöhyke). */
export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Laskelman id palvelimen tunnisteeksi. Sallitut merkit A–Z, a–z, 0–9, _ ja -. */
export function contractId(prefix: string, raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '');
  const id = `${prefix}${cleaned}`.slice(0, 64);
  return ID_RE.test(id) ? id : `${prefix}x`;
}

/** Vapaa osoiteteksti → katu, postinumero, kunta. Postinumero tunnistetaan viidestä numerosta. */
export function splitSiteAddress(
  text: string,
  customer: { address?: string; postalCode?: string; postalLocality?: string },
): { address: string; postcode: string; city: string } {
  const full = text.trim();
  const street = customer.address?.trim() ?? '';
  if (street && full.startsWith(street) && (customer.postalCode?.trim() || customer.postalLocality?.trim())) {
    const rest = full.slice(street.length).replace(/^[,\s]+/, '');
    const expected = [customer.postalCode?.trim(), customer.postalLocality?.trim()].filter(Boolean).join(' ');
    if (rest === expected) {
      return { address: street, postcode: customer.postalCode?.trim() ?? '', city: customer.postalLocality?.trim() ?? '' };
    }
  }
  const match = /^(.*?)[,\s]+(\d{5})(?:\s+(.+))?$/.exec(full);
  if (match) return { address: match[1]!.trim(), postcode: match[2]!, city: (match[3] ?? '').trim() };
  return { address: full, postcode: '', city: '' };
}

function vatFor(line: StructureLine, reverse: boolean): { code: VatCode; bp: number } | null {
  if (reverse) return { code: 'AVL8c', bp: VAT_CODES.AVL8c };
  const bp = scaledInt(line.vatPercent, 100);
  if (bp === VAT_CODES.YLEINEN) return { code: 'YLEINEN', bp };
  if (bp === 0) return { code: 'NOLLA', bp: 0 };
  return null;
}

function specOf(line: StructureLine): ContractLine['spec'] {
  const fields = line.snapshot?.fields ?? [];
  return fields
    .filter((field) => typeof field.key === 'string' && typeof field.value === 'string')
    .map((field) => ({
      key: field.key,
      label: field.label ?? field.key,
      value: field.value,
      ...(field.unit?.trim() ? { unit: field.unit.trim() } : {}),
    }));
}

function materialsOf(
  line: StructureLine,
  problems: ContractProblem[],
): ContractLine['materials'] {
  const rows: MaterialQuantityRow[] = line.materialQuantities ?? [];
  const out: ContractLine['materials'] = [];
  for (const row of rows) {
    const unit = contractUnit(row.unit);
    const qty = scaledInt(row.quantity, 1000);
    if (unit == null) {
      problems.push({ lineName: line.name, message: `Materiaalin "${row.productName}" yksikköä "${row.unit ?? ''}" ei voi lähettää.` });
      continue;
    }
    if (qty == null) {
      problems.push({ lineName: line.name, message: `Materiaalin "${row.productName}" määrä ei ole luku.` });
      continue;
    }
    out.push({ product_id: contractId('', row.productId ?? row.id), name: row.productName, qty_milli: qty, unit });
  }
  return out;
}

/** Sopimuksen summat riveistä samalla tavalla kuin palvelin ne tarkistaa. */
export function contractTotals(lines: ContractLine[]): ContractTotals {
  const byRate = new Map<string, { vat_code: VatCode; vat_bp: number; net_cents: number }>();
  let net = 0;
  let discount = 0;
  let materials = 0;
  let piece = 0;
  let margin = 0;
  let hours = 0;
  let commission = 0;
  for (const line of lines) {
    net += line.net_cents;
    discount += lineGrossBeforeDiscountCents(line.qty_milli, line.unit_e4) - line.net_cents;
    materials += line.materials_cents;
    piece += line.piece_rate_cents;
    margin += line.margin_cents;
    hours += line.hours_milli;
    commission += line.net_cents > 0 ? bpOf(line.net_cents, line.commission_bp) : 0;
    const key = `${line.vat_code}:${line.vat_bp}`;
    const entry = byRate.get(key) ?? { vat_code: line.vat_code, vat_bp: line.vat_bp, net_cents: 0 };
    entry.net_cents += line.net_cents;
    byRate.set(key, entry);
  }
  const vat_breakdown = [...byRate.values()].map((e) => ({ ...e, vat_cents: vatCents(e.net_cents, e.vat_bp) }));
  const vat = vat_breakdown.reduce((sum, e) => sum + e.vat_cents, 0);
  return {
    net_cents: net,
    vat_cents: vat,
    gross_cents: net + vat,
    discount_cents: discount,
    materials_cents: materials,
    piece_rate_cents: piece,
    margin_cents: margin,
    hours_milli: hours,
    commission_cents: commission,
    vat_breakdown,
  };
}

/**
 * Rakentaa luonnoksen. Rivi, jota ei voi lähettää (yksikkö, ALV-kanta, ei-luku), estää lähetyksen
 * ja palauttaa selkeän syyn. Määrältään nollarivit jätetään pois kuten tulosteesta.
 */
export function buildContractOffer(input: BuildContractInput): BuildContractResult {
  const { record } = input;
  const customer = customerFromRecord(record);
  const reverse = customer.reverseVat === true;
  const privateCustomer = isPrivateCustomer(customer);
  const problems: ContractProblem[] = [];
  const mode = readUrakkakorttiMode(record.formSnapshot);
  const overrides = readUrakkakorttiRivihinnat(record.formSnapshot);
  const sourceLines = ensureStructureLines(record).filter((line) => !structureLineQuantityIsZero(line));
  if (sourceLines.length === 0) problems.push({ message: 'Laskelmassa ei ole lähetettäviä rivejä.' });

  const lines: ContractLine[] = [];
  sourceLines.forEach((line, index) => {
    const before = problems.length;
    const unit = contractUnit(line.unit);
    if (unit == null) problems.push({ lineName: line.name, message: `Yksikköä "${line.unit}" ei voi lähettää.` });
    const vat = vatFor(line, reverse);
    if (vat == null) problems.push({ lineName: line.name, message: `ALV ${line.vatPercent} % ei ole sallittu verokanta.` });
    const qtyMilli = line.quantity == null ? 1000 : scaledInt(line.quantity, 1000);
    const unitE4 = scaledInt(line.unitPriceVat0, 10000);
    const discountBp = scaledInt(clampDiscountPercent(line.discountPercent), 100);
    const hours = scaleWorkDuration(line.workDurationDays, line.quantity, input.workdayHours).hours;
    const hoursMilli = scaledInt(hours, 1000);
    const materialsCents = scaledInt(scaleByLineQuantity(line.materialsVat0, line.quantity), 100);
    const pieceCents = scaledInt(alihankkijaLineAmount(line, overrides), 100);
    const marginCents = scaledInt(Number.isFinite(line.marginEur) ? line.marginEur : 0, 100);
    const commissionBp = scaledInt(Number.isFinite(line.commissionPercent) ? line.commissionPercent : 0, 100);
    if (qtyMilli == null || qtyMilli <= 0) problems.push({ lineName: line.name, message: 'Määrä ei ole kelvollinen.' });
    if (unitE4 == null) problems.push({ lineName: line.name, message: 'Hinta ei ole luku.' });
    if (
      discountBp == null || hoursMilli == null || materialsCents == null || pieceCents == null ||
      marginCents == null || commissionBp == null
    ) {
      problems.push({ lineName: line.name, message: 'Rivin luvut eivät ole kelvollisia.' });
    }
    const materials = materialsOf(line, problems);
    if (problems.length > before) return;
    lines.push({
      line_id: contractId('', line.id),
      line_no: index + 1,
      structure_key: line.structureId,
      structure_name: line.name,
      description: line.additionalInfo?.trim() ?? '',
      kind: isManualStructureId(line.structureId) ? 'other' : 'labour',
      qty_milli: qtyMilli!,
      unit: unit!,
      unit_e4: unitE4!,
      discount_bp: discountBp!,
      net_cents: lineNetCents(qtyMilli!, unitE4!, discountBp!),
      vat_code: vat!.code,
      vat_bp: vat!.bp,
      hours_milli: hoursMilli!,
      materials_cents: materialsCents!,
      piece_rate_cents: pieceCents!,
      margin_cents: marginCents!,
      commission_bp: commissionBp!,
      spec: specOf(line),
      materials,
    });
  });
  const ids = new Set<string>();
  for (const line of lines) {
    if (ids.has(line.line_id)) problems.push({ lineName: line.structure_name, message: 'Rivin tunniste toistuu.' });
    ids.add(line.line_id);
  }
  if (problems.length > 0) return { ok: false, problems };

  const siteText = documentSiteAddress(customer, record.formSnapshot);
  const site = splitSiteAddress(siteText, customer);
  const days = readOfferValidDays(record.formSnapshot, input.companyOfferValidDays);
  const commissionBp = scaledInt(Number.isFinite(record.commissionPercent) ? record.commissionPercent : 0, 100) ?? 0;
  const schedule = record.deliveryScheduleText?.trim();
  const draft: ContractOfferDraft = {
    offer_id: contractId('', record.id),
    created_at: record.createdAt instanceof Date && Number.isFinite(record.createdAt.getTime())
      ? record.createdAt.getTime()
      : input.now.getTime(),
    valid_until: localDateString(validUntil(input.now, days)),
    seller: input.sellerName?.trim() ? { name: input.sellerName.trim() } : {},
    customer: {
      customer_id: contractId('', record.customerId ?? `c-${record.id}`),
      kind: privateCustomer ? 'private' : 'company',
      name: customer.name,
      reverse_charge_proposed: reverse,
      household_deduction_eligible: privateCustomer && !reverse && readKtvPageIncluded(record.formSnapshot),
      ...(customer.phone?.trim() ? { phone: customer.phone.trim() } : {}),
      ...(customer.email?.trim() ? { email: customer.email.trim() } : {}),
    },
    site: { site_id: contractId('s-', record.id), ...site },
    vat_mode: reverse ? 'reverse_charge' : 'normal',
    prices_shown: offerIncludesVat(customer, record.formSnapshot) ? 'vat_included' : 'vat_excluded',
    job_card: { mode },
    ...(schedule ? { schedule_wish: { notes: schedule } } : {}),
    commission_bp: commissionBp,
    lines,
    totals: contractTotals(lines),
  };
  return { ok: true, draft };
}

/** Lähetyksen esteet käyttäjälle luettavina riveinä. */
export function contractProblemLines(problems: ContractProblem[]): string[] {
  return problems.map((p) => (p.lineName ? `${p.lineName}: ${p.message}` : p.message));
}
