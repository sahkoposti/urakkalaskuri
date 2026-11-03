import type { CustomerInfo, FormSnapshot } from '@/src/core/models/types';
import { formatCustomerType } from '@/src/core/customer/customerRegister';
import { formatCurrency, formatVatRate } from '@/src/core/utils/formatters';

export function isPrivateCustomer(customer: CustomerInfo): boolean {
  return (customer.customerType ?? 'private') === 'private';
}

export function applyVat(vat0: number, vatPercent: number): number {
  return vat0 * (1 + vatPercent / 100);
}

export function removeVat(vatIncluded: number, vatPercent: number): number {
  return vatIncluded / (1 + vatPercent / 100);
}

/** Yksityisasiakas ilman käänteistä ALV:ta näkee osahinnat ALV:llisina. */
export function customerSeesVatInclusive(customer: CustomerInfo): boolean {
  return isPrivateCustomer(customer) && !customer.reverseVat;
}

/** Uuden rivin hintatila: yritys (ja käänteinen ALV) → ALV 0. */
export function defaultPricesIncludeVat(customer: CustomerInfo): boolean {
  return customerSeesVatInclusive(customer);
}

export type BusinessVatMode = 'alv0' | 'sis';

/**
 * Yritystarjouksen ALV. Puuttuva, tyhjä tai muu kuin `'sis'` = `'alv0'`.
 * Avain on laskelman `form_snapshot.businessVatMode`.
 */
export function readBusinessVatMode(
  snapshot: Pick<FormSnapshot, 'businessVatMode'> | { businessVatMode?: unknown } | null | undefined,
): BusinessVatMode {
  return snapshot?.businessVatMode === 'sis' ? 'sis' : 'alv0';
}

/**
 * Tarjouksen hinnat. Yksi arvo koko tarjoukselle.
 * Yksityinen pysyy verollisena (käänteinen ALV pois lukien). Rivin lippua ei lueta.
 * Yritys lukee vain `businessVatMode`. Puuttuva = ALV 0. Rivin `pricesIncludeVat` ohitetaan,
 * myös vanha `true`. Käänteinen ALV on aina ALV 0, vaikka tila olisi `'sis'`.
 */
export function offerIncludesVat(
  customer: CustomerInfo,
  snapshot?: Pick<FormSnapshot, 'businessVatMode'> | { businessVatMode?: unknown } | null,
): boolean {
  if (customer.reverseVat) return false;
  if ((customer.customerType ?? 'private') !== 'business') return true;
  return readBusinessVatMode(snapshot) === 'sis';
}

/**
 * Ruudun yhteenveto. Yksityinen ennallaan (rivin lippu).
 * Yritys seuraa tarjouksen `businessVatMode`-arvoa, ei rivin lippua. Käänteinen ALV on ALV 0.
 */
export function summaryShowsVatInclusive(
  customer: CustomerInfo,
  lines?: Array<{ pricesIncludeVat?: boolean; quantity?: number }>,
  snapshot?: Pick<FormSnapshot, 'businessVatMode'> | { businessVatMode?: unknown } | null,
): boolean {
  if (customer.reverseVat) return false;
  if ((customer.customerType ?? 'private') === 'business') {
    return readBusinessVatMode(snapshot) === 'sis';
  }
  if (!customerSeesVatInclusive(customer)) return false;
  if (lines && lines.length > 0 && lines.every((line) => line.pricesIncludeVat === false)) {
    return false;
  }
  return true;
}

export function vat0Tag(): string {
  return 'ALV 0';
}

export function vatInclTag(vatPercent: number): string {
  return `ALV ${formatVatRate(vatPercent)}`;
}

export function vatModeTag(includeVat: boolean, vatPercent: number): string {
  return includeVat ? vatInclTag(vatPercent) : vat0Tag();
}

export function labeledWithVatMode(
  label: string,
  includeVat: boolean,
  vatPercent: number,
): string {
  return `${label} (${vatModeTag(includeVat, vatPercent)})`;
}

export function amountInVatMode(
  vat0: number,
  includeVat: boolean,
  vatPercent: number,
): number {
  return includeVat ? applyVat(vat0, vatPercent) : vat0;
}

export function workPriceVat0(totalPriceVat0: number, materialsVat0: number): number {
  return totalPriceVat0 - materialsVat0;
}

export type PriceBreakdownValues = {
  materialsVat0: number;
  discountPercent: number;
  totalPriceVat0: number;
  totalPriceVat: number;
  vatAmount: number;
  vatPercent: number;
  totalPriceVatBeforeDiscount: number;
  totalPriceVat0BeforeDiscount: number;
};

/** Työ = listahinta − materiaalit; alennus näytetään erillisenä rivinä. */
export function listWorkPriceVat0(values: PriceBreakdownValues): number {
  const listVat0 = values.totalPriceVat0BeforeDiscount ?? values.totalPriceVat0;
  return workPriceVat0(listVat0, values.materialsVat0);
}

export function priceBreakdownParts(values: PriceBreakdownValues, includeVat: boolean) {
  const vatRate = values.vatPercent;
  const listVat0 = values.totalPriceVat0BeforeDiscount ?? values.totalPriceVat0;
  const workVat0 = listWorkPriceVat0(values);
  const priceBeforeDiscount = includeVat
    ? (values.totalPriceVatBeforeDiscount ?? values.totalPriceVat)
    : listVat0;
  const priceAfterDiscount = includeVat ? values.totalPriceVat : values.totalPriceVat0;
  const discountAmount = Math.max(0, priceBeforeDiscount - priceAfterDiscount);
  return {
    vatRate,
    materials: amountInVatMode(values.materialsVat0, includeVat, vatRate),
    work: amountInVatMode(workVat0, includeVat, vatRate),
    priceBeforeDiscount,
    priceAfterDiscount,
    discountAmount,
    showDiscount: values.discountPercent > 0 && discountAmount > 0,
  };
}

export function materialsPriceLabel(customer: CustomerInfo, vatPercent = 25.5): string {
  return labeledWithVatMode('Materiaalit', customerSeesVatInclusive(customer), vatPercent);
}

export function formatMaterialsPrice(
  materialsVat0: number,
  customer: CustomerInfo,
  vatPercent: number,
): string {
  return formatCurrency(
    amountInVatMode(materialsVat0, customerSeesVatInclusive(customer), vatPercent),
  );
}

export function displayPrice(vat0: number, vatIncluded: number, customer: CustomerInfo): number {
  return isPrivateCustomer(customer) ? vatIncluded : vat0;
}

export function formatDisplayPrice(
  vat0: number,
  vatIncluded: number,
  customer: CustomerInfo,
): string {
  return formatCurrency(displayPrice(vat0, vatIncluded, customer));
}

export function customerTypeLabel(customer: CustomerInfo): string {
  return formatCustomerType(customer.customerType ?? 'private');
}

export function reverseVatLabel(customer: CustomerInfo): string {
  return customer.reverseVat ? 'Kyllä' : 'Ei';
}
