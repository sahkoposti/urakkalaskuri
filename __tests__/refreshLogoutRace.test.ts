/**
 * B7: a refresh that is in flight when the session is cleared (logout) or replaced (new login)
 * must not write its result afterwards. Synthetic tokens only.
 */
import { createServerClient, OnlineServerError, type FetchLike } from '../src/core/online/serverClient';

function memoryTokens(initial: string | null = null) {
  let token = initial;
  let pending = false;
  return {
    getRefreshToken: async () => token,
    setRefreshToken: async (t: string | null) => {
      token = t;
    },
    getLogoutPending: async () => pending,
    setLogoutPending: async (p: boolean) => {
      pending = p;
    },
    peek: () => token,
    peekPending: () => pending,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

type Res = { status: number; body?: unknown };

/** Fake server: login hands out L<n>, refresh waits on a gate and then answers what the test says. */
function gatedServer() {
  let logins = 0;
  const gates: Array<{ resolve: (r: Res) => void }> = [];
  const refreshStarted: Array<() => void> = [];
  const calls: string[] = [];
  const fetch: FetchLike = async (url, init) => {
    const path = url.replace('https://palvelin.test', '');
    calls.push(`${init?.method} ${path}`);
    let res: Res;
    if (path === '/v1/auth/login') {
      logins += 1;
      res = { status: 200, body: { accessToken: `A_L${logins}`, refreshToken: `R_L${logins}` } };
    } else if (path === '/v1/auth/refresh') {
      const d = deferred<Res>();
      gates.push(d);
      refreshStarted.splice(0).forEach((f) => f());
      res = await d.promise;
    } else if (path === '/v1/auth/logout') {
      res = { status: 200, body: { ok: true } };
    } else if (path === '/v1/tarjoukset/valmistele') {
      res = { status: 401 };
    } else {
      res = { status: 404 };
    }
    return { status: res.status, json: async () => res.body ?? null };
  };
  const nextRefreshStarted = () => new Promise<void>((r) => refreshStarted.push(r));
  return { fetch, gates, calls, nextRefreshStarted };
}

const mk = (fetch: FetchLike, tokens: ReturnType<typeof memoryTokens>) =>
  createServerClient({ baseUrl: 'https://palvelin.test', deviceId: 'testdevice01', fetch, tokens });

const flush = () => new Promise((r) => setImmediate(r));

describe('refresh in flight vs logout / login (B7)', () => {
  it('logout completes while a refresh is in flight: the late refresh result is not written', async () => {
    const srv = gatedServer();
    const tokens = memoryTokens();
    const c = mk(srv.fetch, tokens);
    await c.login('myyja', 'oikea');
    expect(tokens.peek()).toBe('R_L1');

    // A request gets 401 and starts a refresh, which hangs.
    const started = srv.nextRefreshStarted();
    const prep = c.prepare({} as never).catch((e: unknown) => e);
    await started;

    // Logout while the refresh is in flight: the access token is still in memory, so logout goes straight through.
    expect(await c.logout()).toBe(true);
    expect(tokens.peek()).toBeNull();
    expect(tokens.peekPending()).toBe(false);

    // The refresh now succeeds late with a rotated pair: it must not resurrect the session.
    srv.gates[0]!.resolve({ status: 200, body: { accessToken: 'A_LATE', refreshToken: 'R_LATE' } });
    const err = await prep;
    expect(err).toBeInstanceOf(OnlineServerError);
    expect((err as OnlineServerError).code).toBe('not_signed_in');
    await flush();
    expect(tokens.peek()).toBeNull();
    expect(await c.isSignedIn()).toBe(false);
  });

  it('a late refresh 401 after logout + new login does not wipe the new login token', async () => {
    const srv = gatedServer();
    const tokens = memoryTokens();
    const c = mk(srv.fetch, tokens);
    await c.login('myyja', 'oikea');
    const started = srv.nextRefreshStarted();
    const prep = c.prepare({} as never).catch((e: unknown) => e);
    await started;
    expect(await c.logout()).toBe(true);
    await c.login('myyja', 'oikea');
    expect(tokens.peek()).toBe('R_L2');

    srv.gates[0]!.resolve({ status: 401 });
    await prep;
    await flush();
    expect(tokens.peek()).toBe('R_L2');
    expect(await c.isSignedIn()).toBe(true);
  });

  it('a late refresh success after a new login does not overwrite the new login token', async () => {
    const srv = gatedServer();
    const tokens = memoryTokens('R_OLD');
    const c = mk(srv.fetch, tokens);
    const started = srv.nextRefreshStarted();
    const r = c.refresh();
    await started;
    await c.login('myyja', 'oikea');
    srv.gates[0]!.resolve({ status: 200, body: { accessToken: 'A_LATE', refreshToken: 'R_LATE' } });
    expect(await r).toBe(false);
    expect(tokens.peek()).toBe('R_L1');
  });

  it('a refresh with no session change still stores the rotated pair (no regression)', async () => {
    const srv = gatedServer();
    const tokens = memoryTokens('R_OLD');
    const c = mk(srv.fetch, tokens);
    const started = srv.nextRefreshStarted();
    const r = c.refresh();
    await started;
    srv.gates[0]!.resolve({ status: 200, body: { accessToken: 'A_NEW', refreshToken: 'R_NEW' } });
    expect(await r).toBe(true);
    expect(tokens.peek()).toBe('R_NEW');
  });

  it('a new refresh after logout does not join the stale in-flight one', async () => {
    const srv = gatedServer();
    const tokens = memoryTokens();
    const c = mk(srv.fetch, tokens);
    await c.login('myyja', 'oikea');
    const started = srv.nextRefreshStarted();
    const prep = c.prepare({} as never).catch((e: unknown) => e);
    await started;
    expect(await c.logout()).toBe(true);
    await c.login('myyja', 'oikea');
    // Fresh session: a new refresh starts its own request instead of reusing the stale promise.
    const started2 = srv.nextRefreshStarted();
    const r2 = c.refresh();
    await started2;
    expect(srv.gates).toHaveLength(2);
    srv.gates[1]!.resolve({ status: 200, body: { accessToken: 'A_L2b', refreshToken: 'R_L2b' } });
    expect(await r2).toBe(true);
    expect(tokens.peek()).toBe('R_L2b');
    srv.gates[0]!.resolve({ status: 200, body: { accessToken: 'A_LATE', refreshToken: 'R_LATE' } });
    await prep;
    await flush();
    expect(tokens.peek()).toBe('R_L2b');
  });
});
