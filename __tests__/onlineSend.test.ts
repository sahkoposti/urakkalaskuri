import {
  bpOf,
  divRoundHalfAway,
  lineGrossBeforeDiscountCents,
  lineNetCents,
  scaledInt,
  vatCents,
} from '../src/core/online/contractMoney';
import {
  buildContractOffer,
  contractTotals,
  contractUnit,
  type ContractOfferDraft,
} from '../src/core/online/contractOffer';
import { isOnlineSendEnabled } from '../src/core/online/flag';
import { onlineJobCardForRecord } from '../src/core/online/onlineJobCard';
import { onlineCardPrint, onlinePayable, onlinePriceBlock, onlineVatSummary } from '../src/core/online/onlinePrint';
import { onlineSendErrorMessage, sendOnlineOffer, type SendOnlineOfferDeps } from '../src/core/online/sendOnlineOffer';
import { createServerClient, normalizeServerUrl, OnlineServerError, type FetchLike } from '../src/core/online/serverClient';
import { formatVisitTime, visitAddress } from '../src/core/online/visits';
import { buildPdfContext } from '../src/core/pdf/buildPdfContext';
import { renderTarjousHtml } from '../src/core/pdf/renderTarjousHtml';
import { renderUrakkakorttiHtml } from '../src/core/pdf/renderUrakkakorttiHtml';
import { buildUrakkakorttiContext } from '../src/core/pdf/urakkakortti';
import { localOfferNumber } from '../src/core/pdf/exportPdf';
import { cloneCalculationRecord } from '../src/core/database/database';
import type { CalculationRecord } from '../src/core/models/types';
import { input, line, record } from './pdfFixtures';

/** Synteettinen testidata, ei oikeita asiakastietoja eikä oikeita tokeneita. */
const NOW = new Date(2026, 10, 24, 12, 0, 0);
const build = (rec: CalculationRecord) => buildContractOffer({ record: rec, workdayHours: 8, now: NOW });
const draftOf = (rec: CalculationRecord): ContractOfferDraft => {
  const r = build(rec);
  if (!r.ok) throw new Error(JSON.stringify(r.problems));
  return r.draft;
};

describe('contractMoney (server rules)', () => {
  it('rounds half away from zero', () => {
    expect(divRoundHalfAway(BigInt(5), BigInt(10))).toBe(BigInt(1));
    expect(divRoundHalfAway(BigInt(-5), BigInt(10))).toBe(BigInt(-1));
    expect(divRoundHalfAway(BigInt(4), BigInt(10))).toBe(BigInt(0));
  });
  it('line net, gross before discount, vat and bp', () => {
    // 3 × 333,335 € − 10 % = 900,0045 → 900,00 €
    expect(lineNetCents(3000, 3333350, 1000)).toBe(90000);
    expect(lineGrossBeforeDiscountCents(3000, 3333350)).toBe(100001);
    expect(vatCents(100000, 2550)).toBe(25500);
    expect(vatCents(1, 2550)).toBe(0);
    expect(vatCents(2, 2550)).toBe(1);
    expect(bpOf(100000, 500)).toBe(5000);
  });
  it('scaledInt: float noise, half away, invalid', () => {
    expect(scaledInt(0.1 + 0.2, 100)).toBe(30);
    expect(scaledInt(1.005, 100)).toBe(101);
    expect(scaledInt(-1.005, 100)).toBe(-101);
    expect(scaledInt(Number.NaN, 100)).toBeNull();
    expect(scaledInt(Number.MAX_SAFE_INTEGER, 100)).toBeNull();
  });
});

describe('contractUnit', () => {
  it('maps app units to contract units', () => {
    expect(contractUnit('m²')).toBe('m2');
    expect(contractUnit('litraa')).toBe('l');
    expect(contractUnit('jm')).toBe('jm');
    expect(contractUnit('h (työpari)')).toBe('h');
    expect(contractUnit('erä')).toBe('era');
    expect(contractUnit(undefined)).toBe('kpl');
    expect(contractUnit('')).toBe('kpl');
    expect(contractUnit('tynnyri')).toBeNull();
  });
});

describe('buildContractOffer', () => {
  it('private customer, one line: totals the server way, no server-owned fields', () => {
    const d = draftOf(record({}));
    expect(d.offer_id).toBe('calc1');
    expect(d.customer).toMatchObject({ kind: 'private', reverse_charge_proposed: false });
    expect(d.site).toEqual({ site_id: 's-calc1', address: 'Testitie 1', postcode: '20100', city: 'Turku' });
    expect(d.vat_mode).toBe('normal');
    expect(d.lines[0]).toMatchObject({ unit: 'kpl', qty_milli: 1000, unit_e4: 10000000, vat_code: 'YLEINEN', net_cents: 100000 });
    expect(d.totals).toMatchObject({ net_cents: 100000, vat_cents: 25500, gross_cents: 125500, discount_cents: 0 });
    const keys = JSON.stringify(d);
    for (const k of ['offer_number', '"version"', '"status"', 'sent_at', 'changed_at', '"files"', 'user_id']) {
      expect(keys).not.toContain(k);
    }
  });

  it('reverse charge company: AVL8c, zero VAT, line discount', () => {
    const l2 = { ...line('l2', 's2', 'Sokkeli'), unitPriceVat0: 333.335, quantity: 3, unit: 'm²', discountPercent: 10 };
    const d = draftOf(
      record({ customerType: 'company', reverseVat: true } as never, { structureLines: [line('l1', 's1', 'A'), l2] }),
    );
    expect(d.vat_mode).toBe('reverse_charge');
    expect(d.customer.household_deduction_eligible).toBe(false);
    expect(d.lines.map((l) => l.vat_code)).toEqual(['AVL8c', 'AVL8c']);
    expect(d.lines[1]).toMatchObject({ unit: 'm2', qty_milli: 3000, unit_e4: 3333350, discount_bp: 1000, net_cents: 90000 });
    expect(d.totals).toMatchObject({ net_cents: 190000, vat_cents: 0, gross_cents: 190000, discount_cents: 10001 });
    expect(d.totals.vat_breakdown).toEqual([{ vat_code: 'AVL8c', vat_bp: 0, net_cents: 190000, vat_cents: 0 }]);
  });

  it('VAT once per rate on the summed net (not per line)', () => {
    const a = { ...line('a', 's1', 'A'), unitPriceVat0: 0.01 };
    const b = { ...line('b', 's1', 'B'), unitPriceVat0: 0.01 };
    const d = draftOf(record({}, { structureLines: [a, b] }));
    // per line round(1 × 0.255) = 0 each, per rate round(2 × 0.255) = 1
    expect(d.totals.vat_cents).toBe(1);
    expect(contractTotals(d.lines)).toEqual(d.totals);
  });

  it('skips zero-quantity lines', () => {
    const zero = { ...line('z', 's1', 'Nolla'), quantity: 0 };
    const d = draftOf(record({}, { structureLines: [line('l1', 's1', 'A'), zero] }));
    expect(d.lines.map((l) => l.line_id)).toEqual(['l1']);
  });

  it('reports problems instead of sending: unknown unit, disallowed VAT, no lines', () => {
    const bad = { ...line('x', 's1', 'Outo'), unit: 'tynnyri', vatPercent: 14 };
    const r = build(record({}, { structureLines: [bad] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const text = r.problems.map((p) => p.message).join('\n');
    expect(text).toContain('tynnyri');
    expect(text).toContain('14');
    const empty = build(record({}, { structureLines: [{ ...line('z', 's1', 'N'), quantity: 0 }] }));
    expect(empty.ok).toBe(false);
  });
});

describe('serverClient', () => {
  type Call = { url: string; method?: string; body?: string; auth?: string };
  function fakeServer(routes: Record<string, (body: Record<string, unknown>, auth?: string) => { status: number; body?: unknown }>) {
    const calls: Call[] = [];
    const fetch: FetchLike = async (url, init) => {
      const path = url.replace('https://palvelin.test', '');
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ url: path, method: init?.method, body: init?.body as string | undefined, auth: headers.Authorization });
      const handler = routes[`${init?.method} ${path}`];
      const res = handler ? handler(init?.body ? JSON.parse(String(init.body)) : {}, headers.Authorization) : { status: 404 };
      return { status: res.status, json: async () => res.body ?? null };
    };
    return { fetch, calls };
  }
  const memoryTokens = () => {
    let token: string | null = null;
    return {
      getRefreshToken: async () => token,
      setRefreshToken: async (t: string | null) => {
        token = t;
      },
      peek: () => token,
    };
  };

  it('normalizeServerUrl: https only; plain http only in dev builds for exact local hosts', () => {
    expect(normalizeServerUrl('https://palvelin.test/')).toBe('https://palvelin.test');
    expect(normalizeServerUrl('HTTPS://Palvelin.Test:8443/api/')).toBe('https://palvelin.test:8443/api');
    expect(normalizeServerUrl('http://palvelin.test')).toBeNull();
    expect(normalizeServerUrl('ftp://x')).toBeNull();
    expect(normalizeServerUrl('https://palvelin.test/?a=1')).toBeNull();
    expect(normalizeServerUrl('https://palvelin.test:99999')).toBeNull();
    for (const local of ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://10.0.2.2:8080']) {
      expect(normalizeServerUrl(local, { dev: true })).toBe(local);
      expect(normalizeServerUrl(local, { dev: false })).toBeNull();
    }
    // jest (node) has no __DEV__: treated as a release build
    expect(normalizeServerUrl('http://localhost:8080')).toBeNull();
  });

  it('normalizeServerUrl rejects the QA bypass strings and userinfo', () => {
    for (const dev of [true, false]) {
      for (const bad of [
        'http://localhost@evil.example',
        'http://localhost.evil.example',
        'http://127.0.0.1.nip.io',
        'http://10.0.2.2.evil.example',
        'https://user:pw@palvelin.test',
        'https://palvelin.test@evil.example',
        'http://localhost:8080@evil.example',
      ]) {
        expect([bad, dev, normalizeServerUrl(bad, { dev })]).toEqual([bad, dev, null]);
      }
    }
    // https to a lookalike host is allowed (it is just another https server), never downgraded to http
    expect(normalizeServerUrl('https://localhost.evil.example')).toBe('https://localhost.evil.example');
  });

  it('login stores only the refresh token; 401 triggers one refresh and retry', async () => {
    let accessValid = 'A1';
    const { fetch, calls } = fakeServer({
      'POST /v1/auth/login': (b) =>
        b.password === 'oikea'
          ? { status: 200, body: { accessToken: 'A1', refreshToken: 'R1', tokenType: 'Bearer', expiresIn: 900 } }
          : { status: 401, body: { error: 'invalid_credentials' } },
      'POST /v1/auth/refresh': (b) =>
        b.refreshToken === 'R1'
          ? { status: 200, body: { accessToken: 'A2', refreshToken: 'R2', tokenType: 'Bearer', expiresIn: 900 } }
          : { status: 401 },
      'GET /v1/kaynnit': (_b, auth) => (auth === `Bearer ${accessValid}` ? { status: 200, body: { kaynnit: [] } } : { status: 401 }),
    });
    const tokens = memoryTokens();
    const client = createServerClient({ baseUrl: 'https://palvelin.test', deviceId: 'testdevice01', fetch, tokens });
    await expect(client.login('myyja', 'väärä')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await client.login('myyja', 'oikea');
    expect(tokens.peek()).toBe('R1');
    accessValid = 'A2';
    await expect(client.visits()).resolves.toEqual([]);
    expect(tokens.peek()).toBe('R2');
    expect(calls.filter((c) => c.url === '/v1/kaynnit')).toHaveLength(2);
    expect(JSON.parse(calls[1].body!).deviceId).toBe('testdevice01');
  });

  it('concurrent 401s share one refresh (single-flight, rotating refresh token survives)', async () => {
    let accessValid = 'A1';
    let currentRefresh = 'R1';
    let n = 1;
    const { fetch, calls } = fakeServer({
      'POST /v1/auth/login': () => ({ status: 200, body: { accessToken: 'A1', refreshToken: 'R1', tokenType: 'Bearer', expiresIn: 900 } }),
      'POST /v1/auth/refresh': (b) => {
        if (b.refreshToken !== currentRefresh) return { status: 401 };
        n += 1;
        currentRefresh = `R${n}`;
        accessValid = `A${n}`;
        return { status: 200, body: { accessToken: `A${n}`, refreshToken: currentRefresh, tokenType: 'Bearer', expiresIn: 900 } };
      },
      'GET /v1/kaynnit': (_b, auth) => (auth === `Bearer ${accessValid}` ? { status: 200, body: { kaynnit: [] } } : { status: 401 }),
    });
    const tokens = memoryTokens();
    const client = createServerClient({ baseUrl: 'https://palvelin.test', deviceId: 'testdevice01', fetch, tokens });
    await client.login('myyja', 'oikea');
    accessValid = 'expired';
    await expect(Promise.all([client.visits(), client.visits(), client.visits()])).resolves.toEqual([[], [], []]);
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(1);
    expect(tokens.peek()).toBe('R2');
    // after it settles, a later 401 can refresh again
    accessValid = 'expired';
    await expect(client.visits()).resolves.toEqual([]);
    expect(calls.filter((c) => c.url === '/v1/auth/refresh')).toHaveLength(2);
    expect(tokens.peek()).toBe('R3');
  });

  it('maps 409 and invalid_offer; error text carries no tokens', async () => {
    const { fetch } = fakeServer({
      'POST /v1/auth/refresh': () => ({ status: 200, body: { accessToken: 'FAKE_TOKEN_A', refreshToken: 'FAKE_TOKEN_R' } }),
      'POST /v1/tarjoukset/valmistele': () => ({ status: 409, body: { error: 'conflict', code: 'stale' } }),
      'POST /v1/tarjoukset': () => ({
        status: 400,
        body: { error: 'invalid_offer', fields: [{ field: 'lines[0].unit', code: 'invalid' }] },
      }),
    });
    const tokens = memoryTokens();
    await tokens.setRefreshToken('FAKE_TOKEN_R0');
    const client = createServerClient({ baseUrl: 'https://palvelin.test', deviceId: 'testdevice01', fetch, tokens });
    const draft = draftOf(record({}));
    const conflict = await client.prepare(draft).catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(OnlineServerError);
    expect(conflict).toMatchObject({ code: 'conflict', status: 409, conflictCode: 'stale' });
    const invalid = await client.send(draft, { offer_number: '1', version: 1 }, []).catch((e: unknown) => e);
    expect(invalid).toMatchObject({ code: 'invalid_offer' });
    const message = onlineSendErrorMessage(invalid);
    expect(message).toContain('lines[0].unit');
    for (const e of [conflict, invalid]) {
      expect(JSON.stringify(e) + String(e) + onlineSendErrorMessage(e)).not.toMatch(/FAKE_TOKEN/);
    }
  });

  it('not signed in without tokens; network error is friendly', async () => {
    const client = createServerClient({
      baseUrl: 'https://palvelin.test',
      deviceId: 'testdevice01',
      fetch: async () => {
        throw new Error('ECONNREFUSED');
      },
      tokens: memoryTokens(),
    });
    await expect(client.visits()).rejects.toMatchObject({ code: 'not_signed_in' });
    await expect(client.login('a', 'b')).rejects.toMatchObject({ code: 'network' });
    expect(() =>
      createServerClient({ baseUrl: 'https://x', deviceId: 'bad id', fetch: async () => ({ status: 200, json: async () => ({}) }), tokens: memoryTokens() }),
    ).toThrow();
  });
});

describe('onlinePrint', () => {
  const d = draftOf(record({}));
  const online = { offerNumber: '10431', version: 2, totals: d.totals };
  it('price block from server totals', () => {
    expect(onlinePriceBlock(online, true).rows.map((r) => r.label)).toEqual(['Yhteensä alv 0', 'Alv 25,5 %', 'Yhteensä sis. alv']);
    expect(onlinePriceBlock(online, false).rows.map((r) => r.label)).toEqual(['Loppusumma (Alv 0 %)']);
    expect(onlinePayable(online, true)).toBe(1255);
    expect(onlinePayable(online, false)).toBe(1000);
    expect(onlineVatSummary(online, true)).toEqual([{ vatPercent: 25.5, net: 1000, vat: 255, gross: 1255 }]);
    expect(onlineVatSummary(online, false)).toEqual([]);
  });
  it('discount rows when the contract has a discount', () => {
    const withDiscount = { ...online, totals: { ...online.totals, discount_cents: 5000, net_cents: 95000 } };
    expect(onlinePriceBlock(withDiscount, false).rows.map((r) => r.label)).toEqual([
      'Hinta ennen alennusta (alv 0)',
      'Alennus (alv 0)',
      'Loppusumma (Alv 0 %)',
    ]);
  });
  it('offer PDF shows the server number and version', () => {
    const rec = record({});
    const html = renderTarjousHtml(buildPdfContext(input(rec, { online })));
    expect(html).toContain('10431');
    expect(html).toContain('Versio');
    const plain = renderTarjousHtml(buildPdfContext(input(rec)));
    expect(plain).toContain('10285');
    expect(plain).not.toContain('Versio');
  });
  it('localOfferNumber keeps only integer server numbers', () => {
    expect(localOfferNumber('10431')).toBe(10431);
    expect(localOfferNumber('T-1')).toBeNull();
  });
  it('contract card prints the contract piece rates', () => {
    const card = onlineCardPrint(d);
    expect(card).toEqual({ pieceRateCents: 100000, pieceRateCentsByLine: { l1: 100000 } });
    const rec = record({});
    const base = input(rec);
    const html = renderUrakkakorttiHtml(
      buildUrakkakorttiContext({
        record: rec,
        company: base.company,
        structures: base.structures,
        products: base.products,
        settings: base.settings,
        generatedAt: new Date(2026, 9, 10),
        onlineCard: { pieceRateCents: 123456, pieceRateCentsByLine: { l1: 123456 } },
      }),
    );
    expect(html).toMatch(/1\s?234,56/);
  });

  it('job card uses contract cents only for offers sent online (B5)', () => {
    const unsent = record({});
    expect(onlineJobCardForRecord(unsent, { workdayHours: 8 }, NOW)).toBeNull();
    const sent = {
      ...unsent,
      formSnapshot: { ...unsent.formSnapshot, onlineOffer: { offerId: unsent.id, offerNumber: '10431', version: 1, sentAt: 1 } },
    } as CalculationRecord;
    expect(onlineJobCardForRecord(sent, { workdayHours: 8 }, NOW)).toEqual(onlineCardPrint(draftOf(sent)));
  });

  it('job card throws (no silent 0) when an online line amount is missing', () => {
    const rec = record({});
    const base = input(rec);
    expect(() =>
      buildUrakkakorttiContext({
        record: rec,
        company: base.company,
        structures: base.structures,
        products: base.products,
        settings: base.settings,
        generatedAt: new Date(2026, 9, 10),
        onlineCard: { pieceRateCents: 123456, pieceRateCentsByLine: { other: 123456 } },
      }),
    ).toThrow(/rivi puuttuu/);
  });
});

describe('sendOnlineOffer', () => {
  const pdf = { path: 'file:///tmp/t.pdf', fileName: 'Tarjous.pdf' } as never;
  function deps(rec: CalculationRecord, over: Partial<SendOnlineOfferDeps> = {}) {
    const saved: CalculationRecord[] = [];
    const sent: unknown[] = [];
    const d: SendOnlineOfferDeps = {
      client: {
        prepare: async (offer) => ({ offer_id: offer.offer_id, offer_number: '10431', version: 1, totals: offer.totals }),
        send: async (offer, expect, files) => {
          sent.push({ offer, expect, files });
          return { offer_id: offer.offer_id, offer_number: expect.offer_number, version: expect.version, sent_at: 1 };
        },
      },
      getCalculation: async () => saved[saved.length - 1] ?? rec,
      saveCalculation: async (r) => {
        saved.push(r);
      },
      exportOffer: async () => pdf,
      readFileBase64: async () => 'JVBERi0xLjQK',
      workdayHours: 8,
      now: () => NOW,
      ...over,
    };
    return { d, saved, sent };
  }

  it('prepares, prints with the server number, sends the PDF and stores the number', async () => {
    const rec = record({}, { formSnapshot: { fields: [] } as never });
    const exported: unknown[] = [];
    const { d, saved, sent } = deps(rec, {
      exportOffer: async (_id, online) => {
        exported.push(online);
        return pdf;
      },
    });
    const result = await sendOnlineOffer('calc1', d);
    expect(result.offerNumber).toBe('10431');
    expect(exported[0]).toMatchObject({ offerNumber: '10431', version: 1 });
    const call = sent[0] as { files: { file_id: string; kind: string; content_type: string }[] };
    expect(call.files[0]).toMatchObject({ file_id: 'pdf-v1', kind: 'offer_pdf', content_type: 'application/pdf' });
    expect(saved[0].offerNumber).toBe(10431);
    expect(saved[0].formSnapshot?.onlineOffer).toEqual({ offerId: 'calc1', offerNumber: '10431', version: 1, sentAt: 1 });
  });

  it('stops before sending when server totals differ or the file is not a PDF', async () => {
    const rec = record({});
    const mismatch = deps(rec, {
      client: {
        prepare: async (offer) => ({ offer_id: 'x', offer_number: '1', version: 1, totals: { ...offer.totals, net_cents: 1 } }),
        send: async () => {
          throw new Error('should not send');
        },
      },
    });
    await expect(sendOnlineOffer('calc1', mismatch.d)).rejects.toThrow('eivät täsmää');
    const notPdf = deps(rec, { readFileBase64: async () => 'aGVsbG8=' });
    await expect(sendOnlineOffer('calc1', notPdf.d)).rejects.toThrow('PDF');
    expect(notPdf.sent).toHaveLength(0);
  });

  it('retries once from scratch on a conflict', async () => {
    const rec = record({});
    let prepares = 0;
    const { d, sent } = deps(rec);
    const realSend = d.client.send;
    let first = true;
    d.client = {
      prepare: async (offer) => {
        prepares += 1;
        return { offer_id: offer.offer_id, offer_number: '10431', version: prepares, totals: offer.totals };
      },
      send: async (...args) => {
        if (first) {
          first = false;
          throw new OnlineServerError('conflict', 'x', 409);
        }
        return realSend(...args);
      },
    };
    const result = await sendOnlineOffer('calc1', d);
    expect(prepares).toBe(2);
    expect(result.version).toBe(2);
    expect(sent).toHaveLength(1);
  });

  it('a calculation with problems is not sent', async () => {
    const rec = record({}, { structureLines: [{ ...line('x', 's1', 'Outo'), unit: 'tynnyri' }] });
    const { d, sent } = deps(rec);
    await expect(sendOnlineOffer('calc1', d)).rejects.toThrow('tynnyri');
    expect(sent).toHaveLength(0);
  });
});

describe('flag and visits', () => {
  it('online send is off unless EXPO_PUBLIC_ONLINE_SEND=1', () => {
    expect(isOnlineSendEnabled({})).toBe(false);
    expect(isOnlineSendEnabled({ EXPO_PUBLIC_ONLINE_SEND: 'true' })).toBe(false);
    expect(isOnlineSendEnabled({ EXPO_PUBLIC_ONLINE_SEND: '1' })).toBe(true);
  });
  it('visit time and address', () => {
    const v = {
      starts_at: new Date(2026, 10, 24, 9, 0).getTime(),
      ends_at: new Date(2026, 10, 24, 10, 30).getTime(),
      site: { site_id: 's1', address: 'Testitie 1', postcode: '20100', city: 'Turku' },
    };
    expect(formatVisitTime(v)).toBe('ti 24.11.2026 klo 9.00–10.30');
    expect(visitAddress(v)).toBe('Testitie 1, 20100 Turku');
    expect(visitAddress({ site: { site_id: null } })).toBe('');
  });
});

describe('copying a sent calculation', () => {
  it('drops the server number and version from the copy', () => {
    const rec = record({}, {
      offerNumber: 10431,
      formSnapshot: { fields: [], onlineOffer: { offerId: 'calc1', offerNumber: '10431', version: 2, sentAt: 1 } } as never,
    });
    const copy = cloneCalculationRecord(rec, 'calc2', NOW);
    expect(copy.offerNumber).toBeUndefined();
    expect(copy.formSnapshot && 'onlineOffer' in copy.formSnapshot).toBe(false);
    expect(rec.formSnapshot?.onlineOffer?.version).toBe(2);
  });
});
