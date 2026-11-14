import { step, type DocumentsDb, type MigrationStep } from './types';

/** Uusi taulu. CREATE IF NOT EXISTS, ei muuta vanhoja tauluja. Turvallista ajaa kahdesti. */
export const DOCUMENTS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  calculation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('tarjous', 'urakkakortti')),
  offer_number INTEGER,
  version INTEGER NOT NULL,
  file_rel_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  inputs_json TEXT,
  summary_json TEXT,
  app_version TEXT,
  created_at TEXT NOT NULL,
  phone_save_status TEXT NOT NULL DEFAULT 'skipped' CHECK (phone_save_status IN ('ok', 'failed', 'skipped')),
  phone_uri TEXT,
  phone_save_error TEXT
);
CREATE INDEX IF NOT EXISTS documents_calculation_id_idx ON documents (calculation_id);
`;

/**
 * documents-taulun skeema. 2 lisää phone_save_error-sarakkeen.
 * Nosto on idempotentti eikä laske versiota.
 */
export const DOCUMENT_SCHEMA_VERSION = 2;

export async function ensureDocumentsTable(db: DocumentsDb): Promise<void> {
  await db.execAsync(DOCUMENTS_SCHEMA_SQL);
  const columns = await db.getAllAsync('PRAGMA table_info(documents)');
  const names = columns.map((column) => String(column.name ?? ''));
  if (!names.includes('phone_save_error')) {
    await db.execAsync('ALTER TABLE documents ADD COLUMN phone_save_error TEXT');
  }
  const row = await db.getFirstAsync('PRAGMA user_version');
  const current = Number(row?.user_version ?? 0);
  if (!Number.isFinite(current) || current < DOCUMENT_SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${DOCUMENT_SCHEMA_VERSION}`);
  }
}

export const dokumentitMigrations: MigrationStep[] = [
  step('dokumentit.ensureDocumentsTable', 'dokumentit', ensureDocumentsTable),
];
