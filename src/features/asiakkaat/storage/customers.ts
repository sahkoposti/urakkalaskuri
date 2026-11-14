import { getDb } from '../../../core/database/connection';
import type { CustomerType } from '../../../core/models/types';
import type { CustomerRecord } from '../../../core/structure/types';

function customerFromDbRow(row: Record<string, unknown>): CustomerRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    customerType: ((row.customer_type as string) ?? 'private') as CustomerType,
    reverseVat: Boolean(row.reverse_vat),
    phone: (row.phone as string | null) ?? undefined,
    email: (row.email as string | null) ?? undefined,
    address: (row.address as string | null) ?? undefined,
    postalCode: (row.postal_code as string | null) ?? undefined,
    postalLocality: (row.postal_locality as string | null) ?? undefined,
    notes: (row.notes as string | null) ?? undefined,
    updatedAt: new Date(row.updated_at as number),
  };
}

export async function getCustomers(): Promise<CustomerRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM customers ORDER BY name COLLATE NOCASE ASC',
  );
  return rows.map(customerFromDbRow);
}

export async function getCustomer(id: string): Promise<CustomerRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM customers WHERE id = ? LIMIT 1',
    id,
  );
  return row ? customerFromDbRow(row) : null;
}

export async function upsertCustomer(customer: CustomerRecord): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO customers (
      id, name, customer_type, reverse_vat, phone, email, address,
      postal_code, postal_locality, notes, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    customer.id,
    customer.name,
    customer.customerType,
    customer.reverseVat ? 1 : 0,
    customer.phone ?? null,
    customer.email ?? null,
    customer.address ?? null,
    customer.postalCode ?? null,
    customer.postalLocality ?? null,
    customer.notes ?? null,
    customer.updatedAt.getTime(),
  );
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM customers WHERE id = ?', id);
}
