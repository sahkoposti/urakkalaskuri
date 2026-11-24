/**
 * Remnant hardening (CTO 24.11.2026): legacy online secrets in SQLite (preview builds) are deleted on
 * startup and never copied to secure storage; the user is signed out and logs in once. Synthetic data only.
 */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import * as SQLite from 'expo-sqlite';

import * as connection from '../src/core/database/connection';
import { getOnlineSetting, ONLINE_SETTING_KEYS, purgeLegacyOnlineSecretRows } from '../src/core/database/database';
import { LEGACY_ONLINE_SECRET_KEYS } from '../src/core/database/legacyOnlineSecrets';
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

function adapterFor(db: SqlDb) {
  return {
    execAsync: async (sql: string) => db.exec(sql),
    runAsync: async (sql: string, ...params: unknown[]) => db.prepare(sql).run(...(params as never[])),
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
