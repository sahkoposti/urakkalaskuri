import type { CustomerInfo, CustomerType } from '@/src/core/models/types';
import type { CustomerRecord } from '@/src/core/structure/types';

const MAX_NAME_MATCHES = 8;

export function searchCustomersByName(
  customers: CustomerRecord[],
  query: string,
  limit = MAX_NAME_MATCHES,
): CustomerRecord[] {
  const needle = query.trim().toLocaleLowerCase('fi');
  if (!needle) return [];
  return [...customers]
    .filter((customer) => customer.name.toLocaleLowerCase('fi').includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'fi'))
    .slice(0, limit);
}

export function customerMatchLabel(customer: CustomerRecord): string {
  const place = customer.postalLocality?.trim() || customer.address?.trim();
  return place ? `${customer.name} · ${place}` : customer.name;
}

export function customerFromInfo(
  id: string,
  info: CustomerInfo,
  updatedAt = new Date(),
): CustomerRecord {
  return {
    id,
    name: info.name.trim(),
    customerType: info.customerType ?? 'private',
    reverseVat: info.customerType === 'business' ? Boolean(info.reverseVat) : false,
    phone: info.phone?.trim() || undefined,
    email: info.email?.trim() || undefined,
    address: info.address?.trim() || undefined,
    postalCode: info.postalCode?.trim() || undefined,
    postalLocality: info.postalLocality?.trim() || undefined,
    notes: info.notes?.trim() || undefined,
    updatedAt,
  };
}

export function customerSnapshotEquals(a: CustomerInfo, b: CustomerInfo): boolean {
  const left = customerFromInfo('a', a);
  const right = customerFromInfo('b', b);
  return (
    left.name === right.name &&
    left.customerType === right.customerType &&
    left.reverseVat === right.reverseVat &&
    (left.phone ?? '') === (right.phone ?? '') &&
    (left.email ?? '') === (right.email ?? '') &&
    (left.address ?? '') === (right.address ?? '') &&
    (left.postalCode ?? '') === (right.postalCode ?? '') &&
    (left.postalLocality ?? '') === (right.postalLocality ?? '') &&
    (left.notes ?? '') === (right.notes ?? '')
  );
}

export function formatCustomerType(type: CustomerType): string {
  return type === 'business' ? 'Yritysasiakas' : 'Yksityisasiakas';
}
