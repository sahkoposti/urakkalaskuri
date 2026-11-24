import { createRefreshTokenStore, SECURE_REFRESH_TOKEN_KEY, type SecureStoreLike } from '../src/core/online/refreshTokenStore';

function fakes(initialLegacy: string | null, initialSecure: string | null = null) {
  const secureMap = new Map<string, string>();
  if (initialSecure) secureMap.set(SECURE_REFRESH_TOKEN_KEY, initialSecure);
  const secure: SecureStoreLike = {
    getItemAsync: jest.fn(async (k: string) => secureMap.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      secureMap.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      secureMap.delete(k);
    }),
  };
  let legacyValue: string | null = initialLegacy;
  const legacy = {
    get: jest.fn(async () => legacyValue),
    clear: jest.fn(async () => {
      legacyValue = null;
    }),
  };
  return { secure, secureMap, legacy, legacyNow: () => legacyValue };
}

describe('refresh token store (secure-store; legacy SQLite token deleted, not migrated)', () => {
  it('does NOT move a legacy SQLite token to secure storage: it is deleted and the read is signed out', async () => {
    const f = fakes('FAKE_TOKEN_OLD');
    const store = createRefreshTokenStore(f.secure, f.legacy);
    expect(await store.getRefreshToken()).toBeNull();
    expect(f.secure.setItemAsync).not.toHaveBeenCalled();
    expect(f.secureMap.has(SECURE_REFRESH_TOKEN_KEY)).toBe(false);
    expect(f.legacyNow()).toBeNull();
    expect(f.legacy.get).not.toHaveBeenCalled();
    expect(await store.getRefreshToken()).toBeNull();
    expect(f.legacy.clear).toHaveBeenCalledTimes(1);
  });

  it('keeps the secure token if both exist, and still deletes the legacy copy', async () => {
    const f = fakes('FAKE_TOKEN_OLD', 'FAKE_TOKEN_NEW');
    const store = createRefreshTokenStore(f.secure, f.legacy);
    expect(await store.getRefreshToken()).toBe('FAKE_TOKEN_NEW');
    expect(f.legacyNow()).toBeNull();
  });

  it('a failing legacy delete does not break the read and is retried next time', async () => {
    const f = fakes('FAKE_TOKEN_OLD');
    f.legacy.clear.mockRejectedValueOnce(new Error('db busy'));
    const store = createRefreshTokenStore(f.secure, f.legacy);
    expect(await store.getRefreshToken()).toBeNull();
    expect(f.legacyNow()).toBe('FAKE_TOKEN_OLD');
    expect(await store.getRefreshToken()).toBeNull();
    expect(f.legacyNow()).toBeNull();
    expect(f.secure.setItemAsync).not.toHaveBeenCalled();
  });

  it('returns null when nothing is stored', async () => {
    const f = fakes(null);
    const store = createRefreshTokenStore(f.secure, f.legacy);
    expect(await store.getRefreshToken()).toBeNull();
    expect(f.secure.setItemAsync).not.toHaveBeenCalled();
  });

  it('set writes to secure storage; null (logout / 401) deletes it and the legacy copy', async () => {
    const f = fakes('FAKE_TOKEN_OLD');
    const store = createRefreshTokenStore(f.secure, f.legacy);
    await store.setRefreshToken('FAKE_TOKEN_A');
    expect(f.secureMap.get(SECURE_REFRESH_TOKEN_KEY)).toBe('FAKE_TOKEN_A');
    expect(f.legacyNow()).toBeNull();
    await store.setRefreshToken(null);
    expect(f.secureMap.has(SECURE_REFRESH_TOKEN_KEY)).toBe(false);
    expect(await store.getRefreshToken()).toBeNull();
  });

  it('logout-pending flag lives in secure storage', async () => {
    const f = fakes(null);
    const store = createRefreshTokenStore(f.secure, f.legacy);
    expect(await store.getLogoutPending()).toBe(false);
    await store.setLogoutPending(true);
    expect(await createRefreshTokenStore(f.secure, f.legacy).getLogoutPending()).toBe(true);
    await store.setLogoutPending(false);
    expect(await store.getLogoutPending()).toBe(false);
  });
});
