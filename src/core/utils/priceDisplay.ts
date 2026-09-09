import type { CustomerInfo } from '@/src/core/models/types';
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
