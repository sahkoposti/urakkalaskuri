/** T-42: a secure-store read or decrypt failure (e.g. after a restore) means signed out and a new device id, never a crash. */
import { createDeviceIdProvider, SECURE_DEVICE_ID_KEY } from '../src/core/online/deviceIdStore';
import {
  createRefreshTokenStore,
  readSecureOrNull,
  SECURE_LOGOUT_PENDING_KEY,
  SECURE_REFRESH_TOKEN_KEY,
  type SecureStoreLike,
} from '../src/core/online/refreshTokenStore';
import { createServerClient } from '../src/core/online/serverClient';

/** Keys in `broken` throw on read, like a value whose Keystore key did not survive a restore. */
function brokenSecure(initial: Record<string, string>, broken: string[], opts: { failWrites?: boolean } = {}) {
  const map = new Map(Object.entries(initial));
  const bad = new Set(broken);
  const s: SecureStoreLike = {
    getItemAsync: async (k) => {
      if (bad.has(k)) throw new Error('Could not decrypt the value');
      return map.get(k) ?? null;
    },
    setItemAsync: async (k, v) => {
      if (opts.failWrites) throw new Error('Keystore unavailable');
      bad.delete(k);
      map.set(k, v);
    },
    deleteItemAsync: async (k) => {
      bad.delete(k);
      map.delete(k);
    },
  };
  return { s, map };
}
const noLegacy = { get: async () => null, clear: async () => undefined };

describe('secure-store read failure (T-42)', () => {
  it('readSecureOrNull: a throwing read deletes the value and returns null', async () => {
    const { s, map } = brokenSecure({ k: 'x' }, ['k']);
    await expect(readSecureOrNull(s, 'k')).resolves.toBeNull();
    expect(map.has('k')).toBe(false);
    await expect(readSecureOrNull(s, 'k')).resolves.toBeNull();
  });

  it('an undecryptable refresh token means signed out, without throwing', async () => {
    const { s, map } = brokenSecure({ [SECURE_REFRESH_TOKEN_KEY]: 'FAKE_TOKEN' }, [SECURE_REFRESH_TOKEN_KEY]);
    const tokens = createRefreshTokenStore(s, noLegacy);
    await expect(tokens.getRefreshToken()).resolves.toBeNull();
    expect(map.has(SECURE_REFRESH_TOKEN_KEY)).toBe(false);
    const fetch = jest.fn(async () => ({ status: 200, json: async () => ({}) }));
    const c = createServerClient({ baseUrl: 'https://palvelin.test', deviceId: 'testdevice01', fetch, tokens });
    await expect(c.isSignedIn()).resolves.toBe(false);
    await expect(c.visits()).rejects.toMatchObject({ code: 'not_signed_in' });
    await expect(c.retryPendingLogout()).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('an unreadable logout flag is not read as "logout done": the token is dropped, so the app is signed out', async () => {
    const { s, map } = brokenSecure(
      { [SECURE_REFRESH_TOKEN_KEY]: 'FAKE_TOKEN', [SECURE_LOGOUT_PENDING_KEY]: '1' },
      [SECURE_LOGOUT_PENDING_KEY],
    );
    const tokens = createRefreshTokenStore(s, noLegacy);
    await expect(tokens.getLogoutPending()).resolves.toBe(false);
    expect(map.has(SECURE_LOGOUT_PENDING_KEY)).toBe(false);
    expect(map.has(SECURE_REFRESH_TOKEN_KEY)).toBe(false);
    const c = createServerClient({ baseUrl: 'https://palvelin.test', deviceId: 'testdevice01', fetch: async () => ({ status: 200, json: async () => ({}) }), tokens });
    await expect(c.isSignedIn()).resolves.toBe(false);
  });

  it('an undecryptable device id is replaced by a new one and saved', async () => {
    const { s, map } = brokenSecure({ [SECURE_DEVICE_ID_KEY]: 'restored-old-id-999' }, [SECURE_DEVICE_ID_KEY]);
    const id = await createDeviceIdProvider(s, async () => undefined, () => 'fresh-id-after-restore')();
    expect(id).toBe('fresh-id-after-restore');
    expect(map.get(SECURE_DEVICE_ID_KEY)).toBe('fresh-id-after-restore');
  });

  it('if secure storage cannot be written either, the new device id still works for this run', async () => {
    const { s } = brokenSecure({}, [SECURE_DEVICE_ID_KEY], { failWrites: true });
    const failingLegacyClear = async () => {
      throw new Error('db locked');
    };
    const get = createDeviceIdProvider(s, failingLegacyClear, () => 'memory-only-id-01');
    await expect(get()).resolves.toBe('memory-only-id-01');
    await expect(get()).resolves.toBe('memory-only-id-01');
  });
});
