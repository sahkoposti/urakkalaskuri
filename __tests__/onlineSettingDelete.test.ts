/** B8: clearing an online setting (e.g. the legacy SQLite refresh token) deletes the row instead of storing ''. */
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

import * as SQLite from 'expo-sqlite';

import * as connection from '../src/core/database/connection';
import { getOnlineSetting, saveOnlineSetting } from '../src/core/database/database';

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

beforeEach(async () => {
  raw = new DatabaseSync(':memory:');
  const adapter = {
    execAsync: async (sql: string) => raw.exec(sql),
    runAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).run(...(params as never[])),
    getFirstAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).get(...(params as never[])) ?? null,
    getAllAsync: async (sql: string, ...params: unknown[]) => raw.prepare(sql).all(...(params as never[])),
  };
  (SQLite.openDatabaseAsync as jest.Mock).mockResolvedValue(adapter);
  connection.resetDatabaseConnection();
  await connection.getDb();
});

const rowOf = (key: string) => raw.prepare('SELECT key, value FROM settings WHERE key = ?').get(key);

describe('online settings are deleted, not blanked (B8)', () => {
  it('null deletes the legacy refresh token row', async () => {
    await saveOnlineSetting('online_refresh_token', 'R_LEGACY_SYNTHETIC');
    expect(rowOf('online_refresh_token')).toEqual({ key: 'online_refresh_token', value: 'R_LEGACY_SYNTHETIC' });
    await saveOnlineSetting('online_refresh_token', null);
    expect(rowOf('online_refresh_token')).toBeUndefined();
    expect(await getOnlineSetting('online_refresh_token')).toBeNull();
  });

  it('an empty string also deletes the row', async () => {
    await saveOnlineSetting('online_device_id', 'legacy-device-1');
    await saveOnlineSetting('online_device_id', '');
    expect(rowOf('online_device_id')).toBeUndefined();
  });

  it('clearing a key that does not exist is a no-op, and other settings stay', async () => {
    await saveOnlineSetting('online_server_url', 'https://palvelin.example.invalid');
    await saveOnlineSetting('online_refresh_token', null);
    expect(rowOf('online_refresh_token')).toBeUndefined();
    expect(await getOnlineSetting('online_server_url')).toBe('https://palvelin.example.invalid');
  });

  it('an old blank row left by earlier versions still reads as null', async () => {
    raw.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('online_refresh_token', '');
    expect(await getOnlineSetting('online_refresh_token')).toBeNull();
  });
});
