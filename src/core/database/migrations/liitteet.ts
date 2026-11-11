import { step, type DocumentsDb, type MigrationStep } from './types';

/**
 * Liitteet. user_version 3 lisää attachments-taulun.
 * Nosto on idempotentti eikä laske versiota.
 */
export const ATTACHMENT_SCHEMA_VERSION = 3;

export const ATTACHMENTS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY NOT NULL,
  calculation_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'pdf')),
  destination TEXT NOT NULL DEFAULT 'none' CHECK (destination IN ('offer', 'card', 'both', 'none')),
  caption TEXT NOT NULL DEFAULT '' CHECK (length(caption) <= 120),
  file_rel_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attachments_calculation_sort_idx ON attachments (calculation_id, sort_order);
`;

/** Liitetaulu. CREATE IF NOT EXISTS, ei muuta vanhoja tauluja. Turvallista ajaa kahdesti. */
export async function ensureAttachmentsTable(db: DocumentsDb): Promise<void> {
  await db.execAsync(ATTACHMENTS_SCHEMA_SQL);
  const row = await db.getFirstAsync('PRAGMA user_version');
  const current = Number(row?.user_version ?? 0);
  if (!Number.isFinite(current) || current < ATTACHMENT_SCHEMA_VERSION) {
    await db.execAsync(`PRAGMA user_version = ${ATTACHMENT_SCHEMA_VERSION}`);
  }
}

export const liitteetMigrations: MigrationStep[] = [
  step('liitteet.ensureAttachmentsTable', 'liitteet', ensureAttachmentsTable),
];
