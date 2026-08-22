import type { CustomerInfo } from '@/src/core/models/types';
import { formatCurrency } from '@/src/core/utils/formatters';

export function isPrivateCustomer(customer: CustomerInfo): boolean {
  return (customer.customerType ?? 'private') === 'private';
}

export function applyVat(vat0: number, vatPercent: number): number {
  return vat0 * (1 + vatPercent / 100);
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
