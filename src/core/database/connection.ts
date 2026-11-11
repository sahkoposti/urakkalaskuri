import * as SQLite from 'expo-sqlite';

import { runDatabaseInit } from './migrationRunner';
import {
  ATTACHMENT_SCHEMA_VERSION,
  ATTACHMENTS_SCHEMA_SQL,
  ensureAttachmentsTable,
} from './migrations/liitteet';
import {
  CALCULATION_STATUS_SCHEMA_VERSION,
  ensureCalculationStatusColumn,
} from './migrations/laskenta';
import {
  DOCUMENT_SCHEMA_VERSION,
  DOCUMENTS_SCHEMA_SQL,
  ensureDocumentsTable,
} from './migrations/dokumentit';
import {
  ACTIVE_STRUCTURE_KEY,
  inferVatPercent,
  parseFormSnapshot,
  parseStructureLines,
} from './rowParsers';

export {
  ACTIVE_STRUCTURE_KEY,
  inferVatPercent,
  parseFormSnapshot,
  parseStructureLines,
};
export {
  ATTACHMENT_SCHEMA_VERSION,
  ATTACHMENTS_SCHEMA_SQL,
  ensureAttachmentsTable,
};
export { CALCULATION_STATUS_SCHEMA_VERSION, ensureCalculationStatusColumn };
export { DOCUMENT_SCHEMA_VERSION, DOCUMENTS_SCHEMA_SQL, ensureDocumentsTable };

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Nollaa välimuistin (esim. hot reload / kuollut native-kahva Androidilla). */
export function resetDatabaseConnection(): void {
  dbPromise = null;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('urakkalaskuri.db', {
    useNewConnection: true,
  });
  await runDatabaseInit(db);
  return db;
}
