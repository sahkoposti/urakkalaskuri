/** T-36: no Android backup of app data, and the device id lives in secure storage so a restore gets a new one. */
import * as fs from 'fs';
import * as path from 'path';

import { createDeviceIdProvider, SECURE_DEVICE_ID_KEY } from '../src/core/online/deviceIdStore';
import type { SecureStoreLike } from '../src/core/online/refreshTokenStore';

function secureFake(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const s: SecureStoreLike = {
    getItemAsync: async (k) => map.get(k) ?? null,
    setItemAsync: async (k, v) => {
      map.set(k, v);
    },
    deleteItemAsync: async (k) => {
      map.delete(k);
    },
  };
  return { s, map };
}

describe('device id in secure storage (T-36)', () => {
  it('creates an id once, stores it in secure storage and clears the legacy SQLite id', async () => {
    const { s, map } = secureFake();
    const clearLegacy = jest.fn(async () => undefined);
    const gen = jest.fn(() => 'aaaa-bbbb-cccc-1111');
    const get = createDeviceIdProvider(s, clearLegacy, gen);
    const [a, b] = await Promise.all([get(), get()]);
    expect(a).toBe('aaaa-bbbb-cccc-1111');
    expect(b).toBe(a);
    expect(map.get(SECURE_DEVICE_ID_KEY)).toBe(a);
    expect(gen).toHaveBeenCalledTimes(1);
    expect(clearLegacy).toHaveBeenCalledTimes(1);
  });

  it('reuses the stored id across app restarts (new provider, same secure storage)', async () => {
    const { s } = secureFake({ [SECURE_DEVICE_ID_KEY]: 'stored-id-12345' });
    const gen = jest.fn(() => 'new-id-should-not-be-used');
    expect(await createDeviceIdProvider(s, async () => undefined, gen)()).toBe('stored-id-12345');
    expect(gen).not.toHaveBeenCalled();
  });

  it('a restore (secure storage empty, old SQLite data present) gets a NEW id; the old one is not reused', async () => {
    const { s } = secureFake();
    let legacy: string | null = 'restored-old-id-999';
    const id = await createDeviceIdProvider(
      s,
      async () => {
        legacy = null;
      },
      () => 'fresh-id-after-restore',
    )();
    expect(id).toBe('fresh-id-after-restore');
    expect(legacy).toBeNull();
  });

  it('rejects an invalid stored id and replaces it', async () => {
    const { s, map } = secureFake({ [SECURE_DEVICE_ID_KEY]: 'x' });
    expect(await createDeviceIdProvider(s, async () => undefined, () => 'valid-id-0001')()).toBe('valid-id-0001');
    expect(map.get(SECURE_DEVICE_ID_KEY)).toBe('valid-id-0001');
  });
});

describe('Android backup config (T-36)', () => {
  const app = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../app.json'), 'utf8')).expo;

  it('allowBackup is false and no backup / data-extraction rules are configured', () => {
    expect(app.android.allowBackup).toBe(false);
    const text = JSON.stringify(app);
    expect(text).not.toMatch(/fullBackupContent|dataExtractionRules|backup_rules/i);
  });

  it('expo-secure-store plugin does not add its own backup rules', () => {
    const entry = (app.plugins as unknown[]).find((p) => Array.isArray(p) && p[0] === 'expo-secure-store') as
      | [string, { configureAndroidBackup?: boolean }]
      | undefined;
    expect(entry?.[1].configureAndroidBackup).toBe(false);
  });
});
