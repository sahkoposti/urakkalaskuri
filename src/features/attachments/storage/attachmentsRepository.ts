import { getDb } from '@/src/core/database/connection';
import { createId } from '@/src/core/utils/id';

import { copyAttachmentFile, removeStoredAttachment } from '../lib/attachmentFiles';
import { attachmentRelativePath, extensionOfRelativePath } from '../lib/attachmentPaths';
import {
  ATTACHMENT_CAPTION_MAX,
  type Attachment,
  type AttachmentCopyFailure,
  type AttachmentDestination,
  type AttachmentKind,
  type NewAttachmentInput,
} from '../lib/types';

type AttachmentRow = {
  id: string;
  calculation_id: string;
  kind: string;
  destination: string;
  caption: string;
  file_rel_path: string;
  mime: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
};

const DESTINATIONS: readonly AttachmentDestination[] = ['offer', 'card', 'both', 'none'];

export function normalizeCaption(caption: string | undefined): string {
  const value = (caption ?? '').trim();
  if ([...value].length > ATTACHMENT_CAPTION_MAX) {
    throw new Error(`Kuvateksti saa olla enintään ${ATTACHMENT_CAPTION_MAX} merkkiä.`);
  }
  return value;
}

function isKind(value: string): value is AttachmentKind {
  return value === 'image' || value === 'pdf';
}

function isDestination(value: string): value is AttachmentDestination {
  return (DESTINATIONS as readonly string[]).includes(value);
}

function mapRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    calculationId: row.calculation_id,
    kind: isKind(row.kind) ? row.kind : 'image',
    destination: isDestination(row.destination) ? row.destination : 'none',
    caption: row.caption,
    fileRelPath: row.file_rel_path,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function requireDestination(value: AttachmentDestination | undefined): AttachmentDestination {
  if (value === undefined) return 'card';
  if (!isDestination(value)) throw new Error('Virheellinen liitteen kohde.');
  return value;
}

export async function addAttachment(input: NewAttachmentInput): Promise<Attachment> {
  if (!isKind(input.kind)) throw new Error('Virheellinen liitteen laji.');
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0) {
    throw new Error('Virheellinen liitteen koko.');
  }
  const destination = requireDestination(input.destination);
  const caption = normalizeCaption(input.caption);
  const width = finiteOrNull(input.width);
  const height = finiteOrNull(input.height);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const db = await getDb();
  const next = await db.getFirstAsync<{ sort_order: number | null }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS sort_order FROM attachments WHERE calculation_id = ?',
    input.calculationId,
  );
  const sortOrder = next?.sort_order ?? 0;
  await db.runAsync(
    `INSERT INTO attachments (
      id, calculation_id, kind, destination, caption, file_rel_path, mime,
      size_bytes, width, height, sort_order, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.id,
    input.calculationId,
    input.kind,
    destination,
    caption,
    input.fileRelPath,
    input.mime,
    input.sizeBytes,
    width,
    height,
    sortOrder,
    createdAt,
  );
  return {
    id: input.id,
    calculationId: input.calculationId,
    kind: input.kind,
    destination,
    caption,
    fileRelPath: input.fileRelPath,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    width,
    height,
    sortOrder,
    createdAt,
  };
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function listAttachments(calculationId: string): Promise<Attachment[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AttachmentRow>(
    `SELECT * FROM attachments
     WHERE calculation_id = ?
     ORDER BY sort_order ASC, created_at ASC, id ASC`,
    calculationId,
  );
  return rows.map(mapRow);
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AttachmentRow>('SELECT * FROM attachments WHERE id = ? LIMIT 1', id);
  return row ? mapRow(row) : null;
}

export async function updateAttachment(
  id: string,
  patch: { caption?: string; destination?: AttachmentDestination },
): Promise<void> {
  const existing = await getAttachment(id);
  if (!existing) throw new Error('Liitettä ei löydy.');
  const caption = patch.caption === undefined ? existing.caption : normalizeCaption(patch.caption);
  const destination = patch.destination === undefined ? existing.destination : requireDestination(patch.destination);
  const db = await getDb();
  await db.runAsync(
    'UPDATE attachments SET caption = ?, destination = ? WHERE id = ?',
    caption,
    destination,
    id,
  );
}

/** Vaihtaa järjestystä naapurin kanssa. Ensimmäistä ei siirretä ylös eikä viimeistä alas. */
export async function moveAttachment(id: string, direction: 'up' | 'down'): Promise<void> {
  const existing = await getAttachment(id);
  if (!existing) return;
  const rows = await listAttachments(existing.calculationId);
  const index = rows.findIndex((row) => row.id === id);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= rows.length) return;
  const neighbor = rows[neighborIndex]!;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE attachments SET sort_order = ? WHERE id = ?', neighbor.sortOrder, existing.id);
    await db.runAsync('UPDATE attachments SET sort_order = ? WHERE id = ?', existing.sortOrder, neighbor.id);
  });
}

export async function removeAttachment(id: string): Promise<void> {
  const existing = await getAttachment(id);
  if (!existing) return;
  const db = await getDb();
  await db.runAsync('DELETE FROM attachments WHERE id = ?', id);
  removeStoredAttachment(existing.fileRelPath);
}

/** Kaikki laskelman liitteet pois. Myöhempi ”poista kopioidut liitteet” käyttää tätä. */
export async function removeAllAttachments(calculationId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM attachments WHERE calculation_id = ?', calculationId);
  const { deleteCalculationAttachmentFolder } = await import('../lib/attachmentFiles');
  deleteCalculationAttachmentFolder(calculationId);
}

export async function attachmentTotals(
  calculationId: string,
): Promise<{ count: number; sizeBytes: number }> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number; size_bytes: number | null }>(
    'SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS size_bytes FROM attachments WHERE calculation_id = ?',
    calculationId,
  );
  return { count: row?.count ?? 0, sizeBytes: row?.size_bytes ?? 0 };
}

export async function listAttachmentFilePaths(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ file_rel_path: string }>('SELECT file_rel_path FROM attachments');
  return rows.map((row) => row.file_rel_path);
}

/**
 * Kopioi laskelman liitteet uusille id:ille ja tiedostoille.
 * Yhden tiedoston epäonnistuminen ei keskeytä muita eikä heitä.
 */
export async function copyAttachmentsForCalculation(
  sourceCalculationId: string,
  targetCalculationId: string,
  createAttachmentId: () => string = createId,
): Promise<AttachmentCopyFailure[]> {
  const rows = await listAttachments(sourceCalculationId);
  const failures: AttachmentCopyFailure[] = [];
  const db = await getDb();
  for (const row of rows) {
    const id = createAttachmentId();
    const fileRelPath = attachmentRelativePath(
      targetCalculationId,
      id,
      extensionOfRelativePath(row.fileRelPath),
    );
    try {
      copyAttachmentFile(row.fileRelPath, fileRelPath);
    } catch (error) {
      failures.push({ sourceId: row.id, message: errorMessage(error) });
      continue;
    }
    try {
      await db.runAsync(
        `INSERT INTO attachments (
          id, calculation_id, kind, destination, caption, file_rel_path, mime,
          size_bytes, width, height, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        targetCalculationId,
        row.kind,
        row.destination,
        row.caption,
        fileRelPath,
        row.mime,
        row.sizeBytes,
        row.width,
        row.height,
        row.sortOrder,
        row.createdAt,
      );
    } catch (error) {
      try {
        removeStoredAttachment(fileRelPath);
      } catch {
        /* orpo tiedosto siivotaan käynnistyksessä */
      }
      failures.push({ sourceId: row.id, message: errorMessage(error) });
    }
  }
  return failures;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Liitteen kopiointi epäonnistui.';
}
