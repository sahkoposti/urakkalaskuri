/** B8: clearing an online setting deletes the row instead of storing ''. Legacy secret rows: legacyOnlineSecrets.test.ts. */
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
  it('null deletes the row', async () => {
    await saveOnlineSetting('online_username', 'synthetic-user');
    expect(rowOf('online_username')).toEqual({ key: 'online_username', value: 'synthetic-user' });
    await saveOnlineSetting('online_username', null);
    expect(rowOf('online_username')).toBeUndefined();
    expect(await getOnlineSetting('online_username')).toBeNull();
  });

  it('an empty string also deletes the row', async () => {
    await saveOnlineSetting('online_username', 'synthetic-user-2');
    await saveOnlineSetting('online_username', '');
    expect(rowOf('online_username')).toBeUndefined();
  });

  it('clearing a key that does not exist is a no-op, and other settings stay', async () => {
    await saveOnlineSetting('online_server_url', 'https://palvelin.example.invalid');
    await saveOnlineSetting('online_username', null);
    expect(rowOf('online_username')).toBeUndefined();
    expect(await getOnlineSetting('online_server_url')).toBe('https://palvelin.example.invalid');
  });

  it('an old blank row left by earlier versions still reads as null', async () => {
    raw.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('online_username', '');
    expect(await getOnlineSetting('online_username')).toBeNull();
  });
});
