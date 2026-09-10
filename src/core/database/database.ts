import type {
  AppSettings,
  CalculationLine,
  CalculationRecord,
  CustomerType,
  PersistedWizardDraft,
  Product,
  ThemeSettings,
} from '../models/types';
import { defaultSettings, defaultThemeSettings } from '../models/types';
import { parseProductAttributesJson } from '../product/productAttributes';
import { productSortOrder } from '../product/productMutations';
import {
  parseStoredStructureIds,
  productStructureIds,
} from '../product/productStructures';
import { createDefaultFormDefinition } from '../form/defaultFormDefinition';
import { normalizeFormDefinition } from '../form/formDefinitionHelpers';
import { bumpFormVersion } from '../form/formVersion';
import type { FormDebugSettings, FormDefinition } from '../form/types';
import { defaultFormDebugSettings } from '../form/types';
import {
  DEFAULT_STRUCTURE_ID,
  type CustomerRecord,
  type ProductStructure,
} from '../structure/types';
import {
  ACTIVE_STRUCTURE_KEY,
  getDb,
  inferVatPercent,
  parseFormSnapshot,
  parseStructureLines,
  resetDatabaseConnection,
} from './connection';

export { resetDatabaseConnection };

function parseThemeSettings(map: Record<string, string>): ThemeSettings {
  return {
    accentColor: map.theme_accent_color ?? defaultThemeSettings.accentColor,
    primaryColor: map.theme_primary_color ?? defaultThemeSettings.primaryColor,
    textColor: map.theme_text_color ?? defaultThemeSettings.textColor,
    surfaceColor: map.theme_surface_color ?? defaultThemeSettings.surfaceColor,
    backgroundImageUri: map.theme_background_image_uri ?? defaultThemeSettings.backgroundImageUri,
    backgroundOpacity: Number.parseFloat(
      map.theme_background_opacity ?? String(defaultThemeSettings.backgroundOpacity),
    ),
  };
}

function finitePrice(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function productFromRow(row: Record<string, unknown>): Product {
  const structureIds = parseStoredStructureIds(
    row.structure_ids as string | null | undefined,
    row.structure_id as string | null | undefined,
  );
  const unitPrice = finitePrice(row.unit_price_vat0) ?? 0;
  const purchasePrice = finitePrice(row.purchase_price_vat0) ?? unitPrice;
  const salePrice = finitePrice(row.sale_price_vat0) ?? purchasePrice;
  return {
    id: row.id as string,
    name: row.name as string,
    unit: row.unit as string,
    unitPriceVat0: purchasePrice,
    purchasePriceVat0: purchasePrice,
    salePriceVat0: salePrice,
    description: (row.description as string | null) ?? undefined,
    attributes: parseProductAttributesJson(row.attributes as string | null | undefined),
    structureIds,
    structureId: structureIds[0],
    sortOrder: productSortOrder({ sortOrder: finitePrice(row.sort_order) }),
    createdAt: new Date(row.created_at as number),
  };
}

function calculationFromRow(
  row: Record<string, unknown>,
  lines: CalculationLine[],
): CalculationRecord {
  return {
    id: row.id as string,
    projectName: row.project_name as string,
    customer: (row.customer as string | null) ?? undefined,
    groupDurationHours: row.group_duration_h as number,
    crewSize: row.crew_size as number,
    hourlyRate: row.hourly_rate as number,
    marginPercent: row.margin_percent as number,
    commissionPercent: row.commission_percent as number,
    contractPriceVat0: row.contract_price_vat0 as number,
    materialsVat0: row.materials_vat0 as number,
    marginEur: row.margin_eur as number,
    commissionEur: row.commission_eur as number,
    totalPriceVat0: row.total_price_vat0 as number,
    vatPercent: (row.vat_percent as number | null) ?? inferVatPercent(row),
    vatAmount: row.vat_amount as number,
    totalPriceVat: row.total_price_vat as number,
    workDurationDays: row.work_duration_days as number,
    discountPercent: (row.discount_percent as number | null) ?? 0,
    discountEur: (row.discount_eur as number | null) ?? 0,
    totalPriceVatBeforeDiscount:
      (row.total_price_vat_before_discount as number | null) ?? (row.total_price_vat as number),
    totalPriceVat0BeforeDiscount:
      (row.total_price_vat0_before_discount as number | null) ?? (row.total_price_vat0 as number),
    createdAt: new Date(row.created_at as number),
    formSnapshot: parseFormSnapshot(row.form_snapshot),
    lines,
    customerId: (row.customer_id as string | null) ?? undefined,
    deliveryScheduleText: (row.delivery_schedule_text as string | null) ?? undefined,
    travelTimeHours: (row.travel_time_hours as string | null) ?? undefined,
    structureLines: parseStructureLines(row.structure_lines),
  };
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    vatPercent: Number.parseFloat(map.vat_percent ?? String(defaultSettings.vatPercent)),
    defaultMarginPercent: Number.parseFloat(
      map.default_margin_percent ?? String(defaultSettings.defaultMarginPercent),
    ),
    marginLowAmount: Number.parseFloat(
      map.margin_low_amount ?? String(defaultSettings.marginLowAmount),
    ),
    marginLowPercent: Number.parseFloat(
      map.margin_low_percent ?? String(defaultSettings.marginLowPercent),
    ),
    marginHighAmount: Number.parseFloat(
      map.margin_high_amount ?? String(defaultSettings.marginHighAmount),
    ),
    marginHighPercent: Number.parseFloat(
      map.margin_high_percent ?? String(defaultSettings.marginHighPercent),
    ),
    defaultCommissionPercent: Number.parseFloat(
      map.default_commission_percent ?? String(defaultSettings.defaultCommissionPercent),
    ),
    defaultHourlyRate: Number.parseFloat(
      map.default_hourly_rate ?? String(defaultSettings.defaultHourlyRate),
    ),
    defaultCrewSize: Number.parseInt(map.default_crew_size ?? String(defaultSettings.defaultCrewSize), 10),
    workdayHours: Number.parseFloat(map.workday_hours ?? String(defaultSettings.workdayHours)),
    weatherReserveFactor: Number.parseFloat(
      map.weather_reserve_factor ?? String(defaultSettings.weatherReserveFactor),
    ),
    theme: parseThemeSettings(map),
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  const entries: Record<string, string> = {
    vat_percent: String(settings.vatPercent),
    default_margin_percent: String(settings.defaultMarginPercent),
    margin_low_amount: String(settings.marginLowAmount),
    margin_low_percent: String(settings.marginLowPercent),
    margin_high_amount: String(settings.marginHighAmount),
    margin_high_percent: String(settings.marginHighPercent),
    default_commission_percent: String(settings.defaultCommissionPercent),
    default_hourly_rate: String(settings.defaultHourlyRate),
    default_crew_size: String(settings.defaultCrewSize),
    workday_hours: String(settings.workdayHours),
    weather_reserve_factor: String(settings.weatherReserveFactor),
    theme_accent_color: settings.theme.accentColor,
    theme_primary_color: settings.theme.primaryColor,
    theme_text_color: settings.theme.textColor,
    theme_surface_color: settings.theme.surfaceColor,
    theme_background_image_uri: settings.theme.backgroundImageUri,
    theme_background_opacity: String(settings.theme.backgroundOpacity),
  };
  for (const [key, value] of Object.entries(entries)) {
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      key,
      value,
    );
  }
}

export async function getProducts(): Promise<Product[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM products ORDER BY sort_order ASC, name COLLATE NOCASE ASC',
  );
  return rows.map(productFromRow);
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM products WHERE id = ? LIMIT 1',
    id,
  );
  return row ? productFromRow(row) : null;
}

export async function upsertProduct(product: Product): Promise<void> {
  const db = await getDb();
  const structureIds = productStructureIds(product);
  const purchasePrice = product.purchasePriceVat0 ?? product.unitPriceVat0;
  const salePrice = product.salePriceVat0 ?? purchasePrice;
  await db.runAsync(
    `INSERT OR REPLACE INTO products (
      id, name, unit, unit_price_vat0, purchase_price_vat0, sale_price_vat0,
      description, attributes, created_at, structure_id, structure_ids, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    product.id,
    product.name,
    product.unit,
    purchasePrice,
    purchasePrice,
    salePrice,
    product.description ?? null,
    product.attributes ? JSON.stringify(product.attributes) : null,
    product.createdAt.getTime(),
    structureIds[0] ?? null,
    JSON.stringify(structureIds),
    productSortOrder(product),
  );
}

export async function saveProductOrder(productIds: string[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < productIds.length; index += 1) {
      await db.runAsync('UPDATE products SET sort_order = ? WHERE id = ?', index, productIds[index]);
    }
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM products WHERE id = ?', id);
}

export async function getCalculations(): Promise<CalculationRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM calculations ORDER BY created_at DESC',
  );
  const records: CalculationRecord[] = [];
  for (const row of rows) {
    const lineRows = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM calculation_lines WHERE calculation_id = ?',
      row.id as string,
    );
    const lines: CalculationLine[] = lineRows.map((line) => ({
      id: line.id as string,
      productId: (line.product_id as string | null) ?? undefined,
      productName: line.product_name as string,
      unit: line.unit as string,
      unitPriceVat0: line.unit_price_vat0 as number,
      quantity: line.quantity as number,
      lineTotalVat0: line.line_total_vat0 as number,
    }));
    records.push(calculationFromRow(row, lines));
  }
  return records;
}

export async function getCalculation(id: string): Promise<CalculationRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM calculations WHERE id = ?',
    id,
  );
  if (!row) return null;
  const lineRows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM calculation_lines WHERE calculation_id = ?',
    id,
  );
  const lines: CalculationLine[] = lineRows.map((line) => ({
    id: line.id as string,
    productId: (line.product_id as string | null) ?? undefined,
    productName: line.product_name as string,
    unit: line.unit as string,
    unitPriceVat0: line.unit_price_vat0 as number,
    quantity: line.quantity as number,
    lineTotalVat0: line.line_total_vat0 as number,
  }));
  return calculationFromRow(row, lines);
}

export async function saveCalculation(record: CalculationRecord): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO calculations (
        id, project_name, customer, group_duration_h, crew_size, hourly_rate,
        margin_percent, commission_percent, contract_price_vat0, materials_vat0,
        margin_eur, commission_eur, total_price_vat0, vat_percent, vat_amount, total_price_vat,
        work_duration_days, discount_percent, discount_eur,
        total_price_vat_before_discount, total_price_vat0_before_discount,
        created_at, form_snapshot, customer_id, delivery_schedule_text, travel_time_hours, structure_lines
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.projectName,
      record.customer ?? null,
      record.groupDurationHours,
      record.crewSize,
      record.hourlyRate,
      record.marginPercent,
      record.commissionPercent,
      record.contractPriceVat0,
      record.materialsVat0,
      record.marginEur,
      record.commissionEur,
      record.totalPriceVat0,
      record.vatPercent,
      record.vatAmount,
      record.totalPriceVat,
      record.workDurationDays,
      record.discountPercent,
      record.discountEur,
      record.totalPriceVatBeforeDiscount,
      record.totalPriceVat0BeforeDiscount,
      record.createdAt.getTime(),
      record.formSnapshot ? JSON.stringify(record.formSnapshot) : null,
      record.customerId ?? null,
      record.deliveryScheduleText ?? null,
      record.travelTimeHours ?? null,
      record.structureLines ? JSON.stringify(record.structureLines) : null,
    );
    await db.runAsync('DELETE FROM calculation_lines WHERE calculation_id = ?', record.id);
    for (const line of record.lines) {
      await db.runAsync(
        `INSERT INTO calculation_lines (
          id, calculation_id, product_id, product_name, unit,
          unit_price_vat0, quantity, line_total_vat0
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        line.id,
        record.id,
        line.productId ?? null,
        line.productName,
        line.unit,
        line.unitPriceVat0,
        line.quantity,
        line.lineTotalVat0,
      );
    }
  });
}

export async function deleteCalculation(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM calculation_lines WHERE calculation_id = ?', id);
    await db.runAsync('DELETE FROM calculations WHERE id = ?', id);
  });
}

const WIZARD_DRAFT_ID = 'current';

export async function getWizardDraft(): Promise<PersistedWizardDraft | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM wizard_drafts WHERE id = ? LIMIT 1',
    WIZARD_DRAFT_ID,
  );
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as PersistedWizardDraft;
  } catch {
    return null;
  }
}

export async function saveWizardDraft(draft: PersistedWizardDraft): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO wizard_drafts (id, step, payload, updated_at)
     VALUES (?, ?, ?, ?)`,
    WIZARD_DRAFT_ID,
    draft.step,
    JSON.stringify(draft),
    draft.updatedAt,
  );
}

export async function clearWizardDraft(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM wizard_drafts WHERE id = ?', WIZARD_DRAFT_ID);
}

export async function getFormDefinition(): Promise<FormDefinition> {
  const structures = await getProductStructures();
  if (structures.length > 0) {
    const activeId = await getActiveStructureId();
    const active =
      structures.find((item) => item.id === activeId) ??
      structures.find((item) => item.id === DEFAULT_STRUCTURE_ID) ??
      structures[0];
    return active.form;
  }

  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    'form_definition',
  );
  if (!row) {
    const defaults = normalizeFormDefinition(createDefaultFormDefinition());
    await saveFormDefinition(defaults, { preserveVersion: true });
    return defaults;
  }
  try {
    return normalizeFormDefinition(JSON.parse(row.value));
  } catch {
    const defaults = normalizeFormDefinition(createDefaultFormDefinition());
    await saveFormDefinition(defaults, { preserveVersion: true });
    return defaults;
  }
}

export async function saveFormDefinition(
  form: FormDefinition,
  options?: { preserveVersion?: boolean; structureId?: string },
): Promise<void> {
  const toSave = options?.preserveVersion ? form : bumpFormVersion(form);
  const normalized = normalizeFormDefinition({ ...toSave, updatedAt: Date.now() });
  const structures = await getProductStructures();
  const targetId = options?.structureId ?? (await getActiveStructureId());
  const target =
    structures.find((item) => item.id === targetId) ??
    structures.find((item) => item.id === DEFAULT_STRUCTURE_ID) ??
    structures[0];
  if (!target) {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      'form_definition',
      JSON.stringify(normalized),
    );
    return;
  }
  await upsertProductStructure({
    ...target,
    form: normalized,
    updatedAt: new Date(),
  });
}

export async function getFormDebugSettings(): Promise<FormDebugSettings> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    'form_debug',
  );
  if (!row) return { ...defaultFormDebugSettings };
  try {
    return { ...defaultFormDebugSettings, ...(JSON.parse(row.value) as FormDebugSettings) };
  } catch {
    return { ...defaultFormDebugSettings };
  }
}

export async function saveFormDebugSettings(debug: FormDebugSettings): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    'form_debug',
    JSON.stringify(debug),
  );
}

const FIELDS_PAGE_EXPANDED_KEY = 'fields_page_expanded';

export async function getFieldsPageExpandedSetting(): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    FIELDS_PAGE_EXPANDED_KEY,
  );
  return row?.value ?? null;
}

export async function saveFieldsPageExpandedSetting(value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    FIELDS_PAGE_EXPANDED_KEY,
    value,
  );
}

function structureFromRow(row: Record<string, unknown>): ProductStructure {
  return {
    id: row.id as string,
    name: row.name as string,
    unit: (row.unit as string | null) ?? undefined,
    form: normalizeFormDefinition(JSON.parse(row.form_json as string)),
    commissionPercent: row.commission_percent as number,
    sortOrder: row.sort_order as number,
    createdAt: new Date(row.created_at as number),
    updatedAt: new Date(row.updated_at as number),
  };
}

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

export async function getActiveStructureId(): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ? LIMIT 1',
    ACTIVE_STRUCTURE_KEY,
  );
  return row?.value || DEFAULT_STRUCTURE_ID;
}

export async function setActiveStructureId(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ACTIVE_STRUCTURE_KEY,
    id,
  );
}

export async function getProductStructures(): Promise<ProductStructure[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM product_structures ORDER BY sort_order ASC, name COLLATE NOCASE ASC',
  );
  return rows.map(structureFromRow);
}

export async function getProductStructure(id: string): Promise<ProductStructure | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM product_structures WHERE id = ? LIMIT 1',
    id,
  );
  return row ? structureFromRow(row) : null;
}

export async function upsertProductStructure(structure: ProductStructure): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO product_structures (
      id, name, unit, form_json, commission_percent, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    structure.id,
    structure.name,
    structure.unit ?? null,
    JSON.stringify(structure.form),
    structure.commissionPercent,
    structure.sortOrder,
    structure.createdAt.getTime(),
    structure.updatedAt.getTime(),
  );
}

export async function deleteProductStructure(id: string): Promise<void> {
  const structures = await getProductStructures();
  if (structures.length <= 1) {
    throw new Error('Viimeistä tuoterakennetta ei voi poistaa.');
  }
  const fallback =
    structures.find((item) => item.id !== id && item.id === DEFAULT_STRUCTURE_ID) ??
    structures.find((item) => item.id !== id);
  if (!fallback) {
    throw new Error('Viimeistä tuoterakennetta ei voi poistaa.');
  }
  const db = await getDb();
  const products = await getProducts();
  for (const product of products) {
    const nextIds = productStructureIds(product).filter((item) => item !== id);
    if (nextIds.length === productStructureIds(product).length) continue;
    await upsertProduct({
      ...product,
      structureIds: nextIds,
      structureId: nextIds[0],
    });
  }
  await db.runAsync('DELETE FROM product_structures WHERE id = ?', id);
  const activeId = await getActiveStructureId();
  if (activeId === id) {
    await setActiveStructureId(fallback.id);
  }
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

export async function updateCalculationCustomerSnapshots(
  customerId: string,
  projectName: string,
  customerJson: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE calculations SET project_name = ?, customer = ? WHERE customer_id = ?',
    projectName,
    customerJson,
    customerId,
  );
}
