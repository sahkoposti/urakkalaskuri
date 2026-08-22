import type { CustomerInfo } from '@/src/core/models/types';
import { formatCurrency } from '@/src/core/utils/formatters';

export function isPrivateCustomer(customer: CustomerInfo): boolean {
  return (customer.customerType ?? 'private') === 'private';
}

export function applyVat(vat0: number, vatPercent: number): number {
  return vat0 * (1 + vatPercent / 100);
}

export function removeVat(vatIncluded: number, vatPercent: number): number {
  return vatIncluded / (1 + vatPercent / 100);
}

/** Kate/palkkio lasketaan ALV-sisäisestä kokonaishinnasta; näytetään aina alv0. */
export function marginCommissionVat0Amount(
  grossAmount: number,
  customer: CustomerInfo,
  vatPercent: number,
): number {
  if (customer.reverseVat) return grossAmount;
  return removeVat(grossAmount, vatPercent);
}

export function formatMarginCommissionPrice(
  grossAmount: number,
  customer: CustomerInfo,
  vatPercent: number,
): string {
  return formatCurrency(marginCommissionVat0Amount(grossAmount, customer, vatPercent));
}

export function formatContractPriceVat0(contractPriceVat0: number): string {
  return formatCurrency(contractPriceVat0);
}

export function materialsPriceLabel(customer: CustomerInfo): string {
  return isPrivateCustomer(customer) ? 'Materiaalit (alv)' : 'Materiaalit (alv0)';
}

export function formatMaterialsPrice(
  materialsVat0: number,
  customer: CustomerInfo,
  vatPercent: number,
): string {
  if (isPrivateCustomer(customer)) {
    return formatCurrency(applyVat(materialsVat0, vatPercent));
  }
  return formatCurrency(materialsVat0);
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
  return isPrivateCustomer(customer) ? 'Yksityisasiakas' : 'Yritysasiakas';
}

export function reverseVatLabel(customer: CustomerInfo): string {
  return customer.reverseVat ? 'Kyllä' : 'Ei';
}
