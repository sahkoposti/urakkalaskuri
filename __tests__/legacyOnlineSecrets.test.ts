/**
 * Remnant hardening (CTO 24.11.2026): legacy online secrets in SQLite (preview builds) are deleted on
 * startup and never copied to secure storage; the user is signed out and logs in once. Synthetic data only.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as SQLite from 'expo-sqlite';

import * as connection from '../src/core/database/connection';
import { getOnlineSetting, ONLINE_SETTING_KEYS, purgeLegacyOnlineSecretRows } from '../src/core/database/database';
import { LEGACY_ONLINE_SECRET_KEYS, LEGACY_SECRETS_VACUUM_DONE_KEY } from '../src/core/database/legacyOnlineSecrets';
import { createDeviceIdProvider, SECURE_DEVICE_ID_KEY } from '../src/core/online/deviceIdStore';
import { createRefreshTokenStore, SECURE_REFRESH_TOKEN_KEY, type SecureStoreLike } from '../src/core/online/refreshTokenStore';
import { createServerClient, type FetchLike } from '../src/core/online/serverClient';

type SqlDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
  };
};
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => SqlDb };

let raw: SqlDb;
/** Every SQL statement the app ran, in order. */
let sqlLog: string[] = [];
/** Lets a test make one exec statement fail (e.g. VACUUM). */
let failExec: ((sql: string) => boolean) | null = null;

function adapterFor(db: SqlDb) {
  return {
    execAsync: async (sql: string) => {
      sqlLog.push(sql);
      if (failExec?.(sql)) throw new Error('synthetic exec failure');
      db.exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      sqlLog.push(sql);
      return db.prepare(sql).run(...(params as never[]));
    },
    getFirstAsync: async (sql: string, ...params: unknown[]) => db.prepare(sql).get(...(params as never[])) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => db.prepare(sql).all(...(params as never[])),
  };
}

/** Opens the app database again on the same file, like an app restart. */
async function restartApp() {
  connection.resetDatabaseConnection();
  await connection.getDb();
}

const put = (key: string, value: string) =>
  raw.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
const rowOf = (key: string) => raw.prepare('SELECT key, value FROM settings WHERE key = ?').get(key);

function secureFake() {
  const map = new Map<string, string>();
  const s: SecureStoreLike = {
    getItemAsync: jest.fn(async (k: string) => map.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      map.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      map.delete(k);
    }),
  };
  return { s, map };
}

/** A restored preview install: old secret rows plus the non-secret online settings. */
function seedPreviewInstall() {
  put('online_refresh_token', 'R_LEGACY_SYNTHETIC_TOKEN');
  put('online_device_id', 'legacy-device-synthetic-01');
  put('online_server_url', 'https://palvelin.example.invalid');
  put('online_username', 'synthetic-user');
}

beforeEach(async () => {
  sqlLog = [];
  failExec = null;
  raw = new DatabaseSync(':memory:');
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(adapterFor(raw));
  await restartApp();
});

describe('legacy online secrets are deleted, not migrated', () => {
  it('the purge list is exactly the two secrets, and they are no longer readable online settings', () => {
    expect([...LEGACY_ONLINE_SECRET_KEYS].sort()).toEqual(['online_device_id', 'online_refresh_token']);
    for (const k of LEGACY_ONLINE_SECRET_KEYS) expect(ONLINE_SETTING_KEYS as readonly string[]).not.toContain(k);
  });

  it('startup (database open) removes the legacy token and device id rows; server URL and username stay', async () => {
    seedPreviewInstall();
    await restartApp();
    expect(rowOf('online_refresh_token')).toBeUndefined();
    expect(rowOf('online_device_id')).toBeUndefined();
    expect(await getOnlineSetting('online_server_url')).toBe('https://palvelin.example.invalid');
    expect(await getOnlineSetting('online_username')).toBe('synthetic-user');
  });

  it('the explicit purge helper deletes the same rows and is a no-op when they are gone', async () => {
    seedPreviewInstall();
    await purgeLegacyOnlineSecretRows();
    await purgeLegacyOnlineSecretRows();
    expect(rowOf('online_refresh_token')).toBeUndefined();
    expect(rowOf('online_device_id')).toBeUndefined();
    expect(rowOf('online_username')).toEqual({ key: 'online_username', value: 'synthetic-user' });
  });

  it('a legacy token row that appears after startup is still deleted on first use and nothing is copied to secure storage', async () => {
    put('online_refresh_token', 'R_LEGACY_SYNTHETIC_TOKEN');
    const { s, map } = secureFake();
    const tokens = createRefreshTokenStore(s, { clear: purgeLegacyOnlineSecretRows });
    expect(await tokens.getRefreshToken()).toBeNull();
    expect(rowOf('online_refresh_token')).toBeUndefined();
    expect(s.setItemAsync).not.toHaveBeenCalled();
    expect(map.has(SECURE_REFRESH_TOKEN_KEY)).toBe(false);
  });

  it('the legacy device id is not reused: a new id goes to secure storage and the row is gone', async () => {
    put('online_device_id', 'legacy-device-synthetic-01');
    const { s, map } = secureFake();
    const id = await createDeviceIdProvider(s, purgeLegacyOnlineSecretRows, () => 'fresh-device-synthetic-02')();
    expect(id).toBe('fresh-device-synthetic-02');
    expect(map.get(SECURE_DEVICE_ID_KEY)).toBe('fresh-device-synthetic-02');
    expect([...map.values()]).not.toContain('legacy-device-synthetic-01');
    expect(rowOf('online_device_id')).toBeUndefined();
  });

  it('after the upgrade the user is signed out (forced re-login) and no request uses the old token', async () => {
    seedPreviewInstall();
    await restartApp();
    const { s, map } = secureFake();
    const tokens = createRefreshTokenStore(s, { clear: purgeLegacyOnlineSecretRows });
    const fetch = jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async () => ({ status: 500, json: async () => ({}) }));
    const deviceId = await createDeviceIdProvider(s, purgeLegacyOnlineSecretRows, () => 'fresh-device-synthetic-03')();
    const client = createServerClient({ baseUrl: 'https://palvelin.example.invalid', fetch, tokens, deviceId });
    expect(await client.isSignedIn()).toBe(false);
    expect(await client.refresh()).toBe(false);
    for (const call of fetch.mock.calls) expect(String(call[1]?.body ?? '')).not.toContain('R_LEGACY_SYNTHETIC_TOKEN');
    expect([...map.values()]).not.toContain('R_LEGACY_SYNTHETIC_TOKEN');
  });
});

describe('legacy purge is forensic-safe (QA P2)', () => {
  const vacuums = () => sqlLog.filter((q) => q === 'VACUUM').length;
  const flag = () => rowOf(LEGACY_SECRETS_VACUUM_DONE_KEY);

  it('the delete runs with secure_delete ON', async () => {
    seedPreviewInstall();
    sqlLog = [];
    await restartApp();
    const pragma = sqlLog.indexOf('PRAGMA secure_delete = ON');
    const del = sqlLog.findIndex((q) => q.startsWith('DELETE FROM settings WHERE key IN'));
    expect(pragma).toBeGreaterThanOrEqual(0);
    expect(pragma).toBeLessThan(del);
    expect(raw.prepare('PRAGMA secure_delete').get()).toEqual({ secure_delete: 1 });
  });

  it('a real legacy deletion runs checkpoint + VACUUM once; the flag stops a second run', async () => {
    seedPreviewInstall();
    sqlLog = [];
    await restartApp();
    expect(sqlLog).toContain('PRAGMA wal_checkpoint(TRUNCATE)');
    expect(vacuums()).toBe(1);
    expect(flag()).toEqual({ key: LEGACY_SECRETS_VACUUM_DONE_KEY, value: '1' });

    // A legacy row turns up again (e.g. an old backup restored over the data): deleted, but no second VACUUM.
    put('online_refresh_token', 'R_LEGACY_SYNTHETIC_TOKEN_2');
    sqlLog = [];
    await restartApp();
    expect(rowOf('online_refresh_token')).toBeUndefined();
    expect(vacuums()).toBe(0);
  });

  it('no legacy rows: no VACUUM and no flag', async () => {
    sqlLog = [];
    await restartApp();
    await restartApp();
    expect(vacuums()).toBe(0);
    expect(flag()).toBeUndefined();
  });

  it('a failing VACUUM does not block startup, the rows are still gone, and it is retried next time', async () => {
    seedPreviewInstall();
    failExec = (q) => q === 'VACUUM';
    await restartApp();
    expect(rowOf('online_refresh_token')).toBeUndefined();
    expect(flag()).toBeUndefined();
    expect(await getOnlineSetting('online_username')).toBe('synthetic-user');

    failExec = null;
    put('online_device_id', 'legacy-device-synthetic-09');
    sqlLog = [];
    await restartApp();
    expect(vacuums()).toBe(1);
    expect(flag()).toEqual({ key: LEGACY_SECRETS_VACUUM_DONE_KEY, value: '1' });
  });

  it('on a WAL database file the old token bytes are gone from the db and -wal files after startup', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-purge-'));
    const file = path.join(dir, 'urakkalaskuri.db');
    raw = new DatabaseSync(file);
    raw.exec('PRAGMA journal_mode = WAL');
    (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(adapterFor(raw));
    await restartApp();
    const marker = 'R_LEGACY_FORENSIC_MARKER_7f3a9c';
    put('online_refresh_token', marker);
    put('online_username', 'synthetic-user');
    raw.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    expect(fs.readFileSync(file).includes(marker)).toBe(true);
    await restartApp();
    for (const f of [file, `${file}-wal`]) {
      if (fs.existsSync(f)) expect(fs.readFileSync(f).includes(marker)).toBe(false);
    }
    expect(await getOnlineSetting('online_username')).toBe('synthetic-user');
  });
});
