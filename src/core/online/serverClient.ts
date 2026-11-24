/**
 * Palvelimen /v1-asiakas myyjälle: kirjautuminen, tarjouksen valmistelu ja lähetys, listaus, käynnit.
 * fetch ja tokenien tallennus annetaan riippuvuuksina (testit käyttävät väärennöksiä).
 * Pääsytoken pidetään vain muistissa. Uusintatoken tallennetaan TokenStoreen.
 * Mitään tokenia, salasanaa tai niiden osaa ei kirjoiteta lokiin eikä virheviestiin.
 */
import type { ContractOfferDraft, ContractTotals } from './contractOffer';

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<{ status: number; json: () => Promise<unknown> }>;

export interface TokenStore {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
  /**
   * Uloskirjautuminen odottaa palvelimen vahvistusta (T-38). Uusintatoken pidetään tallessa,
   * kunnes palvelin on mitätöinyt istunnon, jotta mitätöinti voidaan yrittää uudelleen myös
   * sovelluksen uudelleenkäynnistyksen jälkeen. Sillä välin sovellus on uloskirjautunut.
   */
  getLogoutPending(): Promise<boolean>;
  setLogoutPending(pending: boolean): Promise<void>;
}

export type OnlineFile = {
  file_id: string;
  kind: 'offer_pdf' | 'photo';
  name: string;
  content_type: 'application/pdf' | 'image/jpeg' | 'image/png';
  data_base64: string;
};

export type PreparedOffer = { offer_id: string; offer_number: string; version: number; totals: ContractTotals };
export type SentOffer = { offer_id: string; offer_number: string; version: number; status?: string; sent_at?: number };
export type OfferListItem = {
  offer_id: string;
  offer_number: string;
  version: number;
  status: string;
  sent_at: number | null;
  changed_at: number | null;
  customer_name: string | null;
  site_address: string | null;
  gross_cents: number | null;
};
export type Visit = {
  visit_id: string;
  task_id: string;
  starts_at: number;
  ends_at: number;
  status: string;
  notes?: string;
  customer: { customer_id: string | null; name?: string };
  site: { site_id: string | null; address?: string; postcode?: string; city?: string };
};

export type ServerErrorCode =
  | 'not_signed_in'
  | 'invalid_credentials'
  | 'too_many_attempts'
  | 'conflict'
  | 'invalid_offer'
  | 'forbidden'
  | 'network'
  | 'server';

/** Virhe ilman salaisuuksia. `fields` = palvelimen kenttävirheet, `conflictCode` = 409-syy. */
export class OnlineServerError extends Error {
  constructor(
    readonly code: ServerErrorCode,
    message: string,
    readonly status?: number,
    readonly fields?: { field: string; code: string }[],
    readonly conflictCode?: string,
  ) {
    super(message);
    this.name = 'OnlineServerError';
  }
}

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2']);
const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ === true;
}

/**
 * Palvelimen osoite: vain https. Pelkkä http sallitaan vain kehitysversiossa (__DEV__) ja vain
 * täsmälleen osoitteille localhost, 127.0.0.1 ja 10.0.2.2. Käyttäjätunnus/salasana osoitteessa
 * (user@host) hylätään. Loppukauttaviiva pois; kysely- ja ankkuriosat hylätään.
 */
export function normalizeServerUrl(raw: string, options: { dev?: boolean } = {}): string | null {
  const dev = options.dev ?? isDevBuild();
  const text = raw.trim().replace(/\/+$/, '');
  const match = /^(https?):\/\/([^/\s?#]+)(\/[^\s?#]*)?$/i.exec(text);
  if (!match) return null;
  const scheme = match[1]!.toLowerCase();
  const authority = match[2]!;
  if (authority.includes('@')) return null;
  const hostPort = /^([^:]+)(?::(\d{1,5}))?$/.exec(authority);
  if (!hostPort) return null;
  const hostname = hostPort[1]!.toLowerCase();
  const port = hostPort[2];
  if (port != null && (Number(port) < 1 || Number(port) > 65535)) return null;
  if (!HOSTNAME_RE.test(hostname)) return null;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }
  // URL-jäsennys ja oma jäsennys samaa mieltä isännästä ja ettei tunnuksia ole.
  if (parsed.username || parsed.password) return null;
  if (parsed.hostname.toLowerCase() !== hostname) return null;
  if (parsed.protocol !== `${scheme}:`) return null;
  if (scheme === 'http' && !(dev && LOCAL_DEV_HOSTS.has(hostname))) return null;
  return `${scheme}://${hostname}${port != null ? `:${port}` : ''}${match[3] ?? ''}`;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export type ServerClientDeps = {
  baseUrl: string;
  deviceId: string;
  fetch: FetchLike;
  tokens: TokenStore;
};

export function createServerClient(deps: ServerClientDeps) {
  if (!DEVICE_ID_RE.test(deps.deviceId)) throw new Error('Laitetunniste ei kelpaa.');
  let accessToken: string | null = null;

  async function raw(method: string, path: string, body?: unknown, auth?: string) {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth) headers.Authorization = `Bearer ${auth}`;
    let res: { status: number; json: () => Promise<unknown> };
    try {
      res = await deps.fetch(`${deps.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new OnlineServerError('network', 'Palvelimeen ei saatu yhteyttä.');
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  }

  function storePair(data: unknown): void {
    if (!isObj(data) || typeof data.accessToken !== 'string' || typeof data.refreshToken !== 'string') {
      throw new OnlineServerError('server', 'Palvelimen vastaus oli virheellinen.');
    }
    accessToken = data.accessToken;
  }

  async function login(username: string, password: string): Promise<void> {
    // Kesken jäänyt uloskirjautuminen yritetään ensin; epäonnistuessa vanha istunto vanhenee palvelimella itsestään.
    if (await deps.tokens.getLogoutPending()) await revokePending();
    const r = await raw('POST', '/v1/auth/login', { username, password, deviceId: deps.deviceId });
    if (r.status === 429) throw new OnlineServerError('too_many_attempts', 'Liian monta yritystä. Yritä hetken päästä.', 429);
    if (r.status === 401 || r.status === 400) throw new OnlineServerError('invalid_credentials', 'Väärä käyttäjätunnus tai salasana.', r.status);
    if (r.status !== 200) throw new OnlineServerError('server', `Kirjautuminen epäonnistui (${r.status}).`, r.status);
    storePair(r.data);
    await deps.tokens.setRefreshToken((r.data as { refreshToken: string }).refreshToken);
    await deps.tokens.setLogoutPending(false);
  }

  let refreshInFlight: Promise<boolean> | null = null;

  /** Yksi uusinta kerrallaan: samanaikaiset 401:t jakavat saman uusintalupauksen. */
  function refresh(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = doRefresh().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function doRefresh(): Promise<boolean> {
    const stored = await deps.tokens.getRefreshToken();
    if (!stored) return false;
    const r = await raw('POST', '/v1/auth/refresh', { refreshToken: stored, deviceId: deps.deviceId });
    if (r.status !== 200) {
      accessToken = null;
      if (r.status === 401 || r.status === 400) await deps.tokens.setRefreshToken(null);
      return false;
    }
    storePair(r.data);
    await deps.tokens.setRefreshToken((r.data as { refreshToken: string }).refreshToken);
    return true;
  }

  async function clearSession(): Promise<void> {
    accessToken = null;
    await deps.tokens.setRefreshToken(null);
    await deps.tokens.setLogoutPending(false);
  }

  /** Mitätöi palvelimen istunnon. Pitää uusintatokenin, kunnes palvelin vahvistaa. */
  async function revokePending(): Promise<boolean> {
    try {
      if (!accessToken) {
        const refreshed = await refresh();
        if (!refreshed) {
          // 401/400: uusintatoken oli jo mitätön (refresh tyhjensi sen) → istunto on jo poissa.
          if (!(await deps.tokens.getRefreshToken())) {
            await clearSession();
            return true;
          }
          return false;
        }
      }
      const r = await raw('POST', '/v1/auth/logout', {}, accessToken!);
      if (r.status === 200 || r.status === 401) {
        // 401 = pääsytoken ei enää kelpaa; yritetään vielä uusinnan kautta kerran.
        if (r.status === 401 && (await refresh())) {
          const again = await raw('POST', '/v1/auth/logout', {}, accessToken!);
          if (again.status !== 200 && again.status !== 401) {
            accessToken = null;
            return false;
          }
        }
        await clearSession();
        return true;
      }
      accessToken = null;
      return false;
    } catch {
      // Ei verkkoa tms.: token jää talteen ja uloskirjautuminen jää kesken.
      accessToken = null;
      return false;
    }
  }

  /** Pyyntö pääsytokenilla. 401 → yksi uusinta uusintatokenilla. */
  async function authed(method: string, path: string, body?: unknown) {
    if (await deps.tokens.getLogoutPending()) {
      throw new OnlineServerError('not_signed_in', 'Kirjaudu ensin palvelimelle (Asetukset).');
    }
    if (!accessToken && !(await refresh())) {
      throw new OnlineServerError('not_signed_in', 'Kirjaudu ensin palvelimelle (Asetukset).');
    }
    let r = await raw(method, path, body, accessToken!);
    if (r.status === 401) {
      if (!(await refresh())) throw new OnlineServerError('not_signed_in', 'Kirjautuminen vanhentui. Kirjaudu uudelleen.', 401);
      r = await raw(method, path, body, accessToken!);
    }
    if (r.status === 401) throw new OnlineServerError('not_signed_in', 'Kirjautuminen vanhentui. Kirjaudu uudelleen.', 401);
    if (r.status === 403) throw new OnlineServerError('forbidden', 'Tunnuksella ei ole oikeutta tähän.', 403);
    return r;
  }

  function offerError(r: { status: number; data: unknown }): never {
    const d = isObj(r.data) ? r.data : {};
    if (r.status === 409) {
      const code = typeof d.code === 'string' ? d.code : undefined;
      throw new OnlineServerError('conflict', 'Tarjous on muuttunut palvelimella. Valmistele uudelleen.', 409, undefined, code);
    }
    if (r.status === 400 && d.error === 'invalid_offer') {
      const fields = Array.isArray(d.fields)
        ? d.fields.filter(isObj).map((f) => ({ field: String(f.field), code: String(f.code) }))
        : [];
      throw new OnlineServerError('invalid_offer', 'Palvelin hylkäsi tarjouksen tiedot.', 400, fields);
    }
    throw new OnlineServerError('server', `Palvelin vastasi ${r.status}.`, r.status);
  }

  return {
    login,
    refresh,
    isSignedIn: async () =>
      !(await deps.tokens.getLogoutPending()) && (accessToken != null || (await deps.tokens.getRefreshToken()) != null),
    /**
     * Uloskirjautuminen: sovellus on heti uloskirjautunut. Palvelimen istunto mitätöidään; jos se ei
     * onnistu (ei verkkoa), uusintatoken jää talteen ja mitätöinti yritetään uudelleen
     * (retryPendingLogout käynnistyksessä, tai ennen seuraavaa kirjautumista).
     * Palauttaa true, kun palvelin vahvisti mitätöinnin tai istunto oli jo mitätön.
     */
    async logout(): Promise<boolean> {
      await deps.tokens.setLogoutPending(true);
      return revokePending();
    },
    /** Kesken jäänyt uloskirjautuminen uudelleen. false = ei kesken tai ei vielä onnistunut. */
    async retryPendingLogout(): Promise<boolean> {
      if (!(await deps.tokens.getLogoutPending())) return false;
      return revokePending();
    },
    async prepare(offer: ContractOfferDraft): Promise<PreparedOffer> {
      const r = await authed('POST', '/v1/tarjoukset/valmistele', { offer });
      if (r.status !== 200) offerError(r);
      const d = r.data;
      if (!isObj(d) || typeof d.offer_number !== 'string' || typeof d.version !== 'number' || !isObj(d.totals)) {
        throw new OnlineServerError('server', 'Palvelimen vastaus oli virheellinen.');
      }
      return d as unknown as PreparedOffer;
    },
    async send(
      offer: ContractOfferDraft,
      expect: { offer_number: string; version: number },
      files: OnlineFile[],
    ): Promise<SentOffer> {
      const r = await authed('POST', '/v1/tarjoukset', { offer, expect, files });
      if (r.status !== 201 && r.status !== 200) offerError(r);
      const d = r.data;
      if (!isObj(d) || typeof d.offer_number !== 'string' || typeof d.version !== 'number') {
        throw new OnlineServerError('server', 'Palvelimen vastaus oli virheellinen.');
      }
      return d as unknown as SentOffer;
    },
    async listOffers(): Promise<OfferListItem[]> {
      const r = await authed('GET', '/v1/tarjoukset');
      if (r.status !== 200 || !isObj(r.data) || !Array.isArray(r.data.tarjoukset)) offerError(r);
      return (r.data as { tarjoukset: OfferListItem[] }).tarjoukset;
    },
    async visits(): Promise<Visit[]> {
      const r = await authed('GET', '/v1/kaynnit');
      if (r.status !== 200 || !isObj(r.data) || !Array.isArray(r.data.kaynnit)) offerError(r);
      return (r.data as { kaynnit: Visit[] }).kaynnit;
    },
  };
}

export type ServerClient = ReturnType<typeof createServerClient>;
