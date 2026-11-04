import { getDb } from '@/src/core/database/connection';

import { removeStoredPdf } from './documentFiles';
import type {
  DocumentInputs,
  DocumentKind,
  DocumentSummary,
  NewDocumentInput,
  PhoneSaveStatus,
  SavedDocument,
} from './types';

type DocumentRow = {
  id: string;
  calculation_id: string;
  kind: string;
  offer_number: number | null;
  version: number;
  file_rel_path: string;
  file_name: string;
  inputs_json: string | null;
  summary_json: string | null;
  app_version: string | null;
  created_at: string;
  phone_save_status: string;
  phone_uri: string | null;
};

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isKind(value: string): value is DocumentKind {
  return value === 'tarjous' || value === 'urakkakortti';
}

function isPhoneStatus(value: string): value is PhoneSaveStatus {
  return value === 'ok' || value === 'failed' || value === 'skipped';
}

function mapRow(row: DocumentRow): SavedDocument {
  return {
    id: row.id,
    calculationId: row.calculation_id,
    kind: isKind(row.kind) ? row.kind : 'tarjous',
    offerNumber: row.offer_number,
    version: row.version,
    fileRelPath: row.file_rel_path,
    fileName: row.file_name,
    inputs: parseJson<DocumentInputs>(row.inputs_json),
    summary: parseJson<DocumentSummary>(row.summary_json),
    appVersion: row.app_version,
    createdAt: row.created_at,
    phoneSaveStatus: isPhoneStatus(row.phone_save_status) ? row.phone_save_status : 'skipped',
    phoneUri: row.phone_uri,
  };
}

export async function insertDocument(input: NewDocumentInput): Promise<SavedDocument> {
  const db = await getDb();
  let version = 1;
  await db.withTransactionAsync(async () => {
    const current = await db.getFirstAsync<{ version: number | null }>(
      'SELECT MAX(version) AS version FROM documents WHERE calculation_id = ? AND kind = ?',
      input.calculationId,
      input.kind,
    );
    version = (current?.version ?? 0) + 1;
    await db.runAsync(
      `INSERT INTO documents (
        id, calculation_id, kind, offer_number, version, file_rel_path, file_name,
        inputs_json, summary_json, app_version, created_at, phone_save_status, phone_uri
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'skipped', NULL)`,
      input.id,
      input.calculationId,
      input.kind,
      input.offerNumber,
      version,
      input.fileRelPath,
      input.fileName,
      JSON.stringify(input.inputs),
      JSON.stringify(input.summary),
      input.appVersion,
      input.createdAt,
    );
  });
  return {
    ...input,
    version,
    inputs: input.inputs,
    summary: input.summary,
    phoneSaveStatus: 'skipped',
    phoneUri: null,
  };
}

export async function listDocumentFilePaths(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ file_rel_path: string }>(
    'SELECT file_rel_path FROM documents',
  );
  return rows.map((row) => row.file_rel_path);
}

export async function listDocumentsByCalculation(calculationId: string): Promise<SavedDocument[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT * FROM documents
     WHERE calculation_id = ?
     ORDER BY created_at DESC, version DESC, id DESC`,
    calculationId,
  );
  return rows.map(mapRow);
}

export async function getDocument(id: string): Promise<SavedDocument | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<DocumentRow>('SELECT * FROM documents WHERE id = ? LIMIT 1', id);
  return row ? mapRow(row) : null;
}

export async function deleteDocument(id: string): Promise<void> {
  const existing = await getDocument(id);
  if (!existing) return;
  const db = await getDb();
  await db.runAsync('DELETE FROM documents WHERE id = ?', id);
  removeStoredPdf(existing.fileRelPath);
}
