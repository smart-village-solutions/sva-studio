import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { Client } from 'pg';
const state = vi.hoisted(() => ({
  load: vi.fn(),
  verify: vi.fn(),
  query: vi.fn(),
  translate: vi.fn(),
  ready: vi.fn(),
  rate: vi.fn(),
}));
vi.mock('@sva/data-repositories/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/data-repositories/server')>()),
  loadDefaultExternalInterfaceRecord: state.load,
}));
vi.mock('./db.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./db.js')>()),
  withIamAppDb: async (work: (client: unknown) => Promise<unknown>) => work({ query: state.query }),
}));
vi.mock('./service-token.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./service-token.js')>()),
  verifyServiceJwt: state.verify,
}));
vi.mock('./shared/rate-limit.js', () => ({ consumeRateLimit: state.rate }));
vi.mock('./app-translations-deepl.js', () => ({
  getDeepLSetupStatus: state.ready,
  translateDeepLValues: state.translate,
  assertDeepLRequestSize: vi.fn(),
}));
import { appTranslationServiceHandler } from './app-translations-service.js';
const binding = {
  issuer: 'https://identity.example/realms/test',
  clientId: 'main-server',
  subject: 'service-subject',
  audience: 'studio',
};
const payload = () => ({
  schemaVersion: 1,
  instanceId: 'de-town',
  requestId: '11111111-1111-4111-8111-111111111111',
  sourceDigest: 'a'.repeat(64),
  profileId: 'news-v1',
  sourceLocale: 'de',
  targetLocale: 'en',
  entries: [
    { key: 'title', text: 'Nachricht', format: 'plain' },
    { key: 'contentBlocks.0.body', text: '<p>Hallo</p>', format: 'html' },
  ],
});
const request = (data = payload(), auth = true) =>
  new Request('https://studio.example/api/v1/app-translations/translate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: 'Bearer test' } : {}),
    },
    body: JSON.stringify(data),
  });
let connection: Record<string, unknown>;
let provider: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  connection = {
    id: 'connection',
    enabled: true,
    updatedAt: '1',
    publicConfig: { translationService: binding },
  };
  provider = {
    id: 'deepl',
    updatedAt: '1',
    publicConfig: {
      revision: '1',
      plan: 'free',
      credentialRevision: '1',
      verifiedCredentialRevision: '1',
      englishVariant: 'en-GB',
      selectedLocales: ['en'],
      availableLanguages: [{ code: 'en-GB', name: 'English', tagHandling: true }],
    },
  };
  state.load.mockImplementation(async (_instance, type) =>
    type === 'sva_mainserver' ? connection : provider
  );
  state.verify.mockResolvedValue({ azp: binding.clientId, sub: binding.subject });
  state.query.mockResolvedValue({ rows: [{ generation: '1' }] });
  state.ready.mockReturnValue({ ready: true });
  state.rate.mockReturnValue(null);
  state.translate.mockResolvedValue(['News', '<p>Hello</p>']);
});
afterEach(() => vi.useRealTimers());
describe('technical news translation', () => {
  it.each(['', ' \n\t'])(
    'rejects empty optional entries before provider work (%j)',
    async (text) => {
      for (const key of [
        'author',
        'keywords',
        'contentBlocks.0.title',
        'contentBlocks.0.intro',
        'contentBlocks.0.body',
      ]) {
        const input = payload();
        input.entries = [
          input.entries[0]!,
          { key, text, format: key.endsWith('.body') ? 'html' : 'plain' },
        ];
        expect((await appTranslationServiceHandler(request(input))).status).toBe(400);
        expect(state.translate).not.toHaveBeenCalled();
      }
    }
  );
  it('returns the complete ordered group and correlation without role grants or persistence', async () => {
    const response = await appTranslationServiceHandler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      requestId: payload().requestId,
      sourceDigest: payload().sourceDigest,
      targetLocale: 'en',
      entries: [
        { key: 'title', format: 'plain', text: 'News' },
        { key: 'contentBlocks.0.body', format: 'html', text: '<p>Hello</p>' },
      ],
    });
    expect(state.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
    expect(state.translate).toHaveBeenCalledTimes(1);
    expect(state.translate).toHaveBeenCalledWith(
      provider,
      'en-GB',
      payload().entries.map((entry) => entry.text),
      expect.any(AbortSignal)
    );
  });
  it.each([
    { azp: binding.clientId, sub: 'human' },
    { azp: 'other', sub: binding.subject },
  ])('rejects a human subject or wrong client', async (identity) => {
    state.verify.mockResolvedValue(identity);
    expect((await appTranslationServiceHandler(request())).status).toBe(403);
    expect(state.translate).not.toHaveBeenCalled();
  });
  it('requires bearer authentication and an explicitly configured binding', async () => {
    expect((await appTranslationServiceHandler(request(payload(), false))).status).toBe(401);
    connection.publicConfig = {};
    expect((await appTranslationServiceHandler(request())).status).toBe(403);
    expect(state.translate).not.toHaveBeenCalled();
  });
  it('rejects an invalid issuer or audience verified by the shared verifier', async () => {
    state.verify.mockRejectedValue(new Error('invalid_token'));
    expect((await appTranslationServiceHandler(request())).status).toBe(401);
    expect(state.verify).toHaveBeenCalledWith('test', binding);
    expect(state.translate).not.toHaveBeenCalled();
  });
  it('requires an active instance and translation module', async () => {
    state.query.mockResolvedValue({ rows: [] });
    expect((await appTranslationServiceHandler(request())).status).toBe(403);
    expect(state.translate).not.toHaveBeenCalled();
  });
  it('does not return a partial or structurally changed result', async () => {
    for (const translated of [
      ['News'],
      ['News', '<p><a href="https://evil.example">Hello</a></p>'],
    ]) {
      state.translate.mockResolvedValue(translated);
      const response = await appTranslationServiceHandler(request());
      expect(response.status).toBe(502);
      expect(await response.json()).not.toHaveProperty('entries');
    }
  });
  it('rechecks connection changes after provider work', async () => {
    state.translate.mockImplementation(async () => {
      connection = { ...connection, updatedAt: '2' };
      return ['News', '<p>Hello</p>'];
    });
    expect((await appTranslationServiceHandler(request())).status).toBe(403);
  });
  it('rejects unsupported profiles, formats, duplicate keys and unsafe HTML before translation', async () => {
    const cases = [
      { ...payload(), profileId: 'anything' },
      { ...payload(), entries: [...payload().entries, payload().entries[0]] },
      {
        ...payload(),
        entries: [
          { key: 'title', text: 'Hi', format: 'plain' },
          { key: 'contentBlocks.0.body', text: '<script>bad()</script>', format: 'html' },
        ],
      },
    ];
    for (const input of cases)
      expect(
        (await appTranslationServiceHandler(request(input as ReturnType<typeof payload>))).status
      ).toBe(400);
    expect(state.translate).not.toHaveBeenCalled();
  });
});

it('accepts a title-only news group and all agreed plain metadata fields', async () => {
  const input = payload();
  input.entries = [input.entries[0]!];
  state.translate.mockResolvedValue(['News']);
  expect((await appTranslationServiceHandler(request(input))).status).toBe(200);
  input.entries.push(
    { key: 'author', text: 'Redaktion', format: 'plain' },
    { key: 'keywords', text: 'Stadt', format: 'plain' },
    { key: 'contentBlocks.0.title', text: 'Titel', format: 'plain' },
    { key: 'contentBlocks.0.intro', text: 'Einleitung', format: 'plain' }
  );
  state.translate.mockResolvedValue(input.entries.map(() => 'English'));
  expect((await appTranslationServiceHandler(request(input))).status).toBe(200);
});
it('rejects a different tenant binding, disabled languages and revoked access without provider calls', async () => {
  state.load.mockImplementation(async (instance, type) =>
    instance === 'de-other' ? null : type === 'sva_mainserver' ? connection : provider
  );
  expect(
    (await appTranslationServiceHandler(request({ ...payload(), instanceId: 'de-other' }))).status
  ).toBe(403);
  provider.publicConfig = { ...(provider.publicConfig as object), selectedLocales: [] };
  expect((await appTranslationServiceHandler(request())).status).toBe(403);
  expect(state.translate).not.toHaveBeenCalled();
});
it('rejects provider failures and rate limits with safe errors and no partial entries', async () => {
  state.translate.mockRejectedValue(new Error('deepl_unavailable'));
  let response = await appTranslationServiceHandler(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: 'service_unavailable', retryable: true });
  state.rate.mockReturnValue(new Response('', { status: 429 }));
  response = await appTranslationServiceHandler(request());
  expect(response.status).toBe(429);
  expect(state.translate).toHaveBeenCalledTimes(1);
});
it('enforces the full-group source and entry limits before calling the provider', async () => {
  const input = payload();
  input.entries = [{ key: 'title', text: 'x'.repeat(90001), format: 'plain' }];
  expect((await appTranslationServiceHandler(request(input))).status).toBe(400);
  input.entries = Array.from({ length: 51 }, (_, index) => ({
    key: index ? `contentBlocks.${index}.intro` : 'title',
    text: 'Text',
    format: 'plain',
  }));
  expect((await appTranslationServiceHandler(request(input))).status).toBe(400);
  expect(state.translate).not.toHaveBeenCalled();
});

it('discards a result when the language or module is revoked during provider work', async () => {
  state.translate.mockImplementation(async () => {
    state.query.mockResolvedValue({ rows: [] });
    return ['News', '<p>Hello</p>'];
  });
  const response = await appTranslationServiceHandler(request());
  expect(response.status).toBe(403);
  expect(await response.json()).not.toHaveProperty('entries');
});

it('rejects an oversized full response instead of sending a partial group', async () => {
  state.translate.mockResolvedValue(['x'.repeat(60000), '<p>' + 'x'.repeat(90000) + '</p>']);
  const response = await appTranslationServiceHandler(request());
  expect(response.status).toBe(502);
  expect(await response.json()).not.toHaveProperty('entries');
});

it.each([
  ['terminal', 502, false],
  ['retryable', 503, true],
] as const)('preserves the provider %s retry classification', async (kind, status, retryable) => {
  state.translate.mockRejectedValue(
    Object.assign(new Error('deepl_unavailable'), { cause: { retry: { kind } } })
  );
  const response = await appTranslationServiceHandler(request());
  expect(response.status).toBe(status);
  expect(await response.json()).toMatchObject({ retryable });
});

it.each([' '.repeat(3), 'x'.repeat(100001), 'ä'.repeat(50001)])(
  'rejects blank or oversized UTF-8 entries accepted by neither service consumer',
  async (text) => {
    state.translate.mockResolvedValue([text, '<p>Hello</p>']);
    const response = await appTranslationServiceHandler(request());
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty('entries');
  }
);

it.each(['Basic test', 'Bearer', 'Bearer two tokens'])(
  'rejects malformed authorization %s before database or provider work',
  async (authorization) => {
    const input = new Request(request(), {
      headers: { 'content-type': 'application/json', authorization },
    });
    expect((await appTranslationServiceHandler(input)).status).toBe(401);
    expect(state.verify).not.toHaveBeenCalled();
    expect(state.load).not.toHaveBeenCalled();
    expect(state.translate).not.toHaveBeenCalled();
  }
);

it('rejects malformed JSON, invalid UTF-8, missing bodies and incorrect content types', async () => {
  for (const body of ['{', new Uint8Array([255])]) {
    const response = await appTranslationServiceHandler(new Request(request(), { body }));
    expect(response.status).toBe(400);
  }
  expect(
    (
      await appTranslationServiceHandler(
        new Request(request().url, { method: 'POST', headers: request().headers })
      )
    ).status
  ).toBe(400);
  expect(
    (
      await appTranslationServiceHandler(
        new Request(request(), {
          headers: { authorization: 'Bearer test', 'content-type': 'text/plain' },
        })
      )
    ).status
  ).toBe(415);
  expect(state.verify).not.toHaveBeenCalled();
  expect(state.translate).not.toHaveBeenCalled();
});

it('bounds a streamed body without Content-Length at 100000 bytes and cancels the reader', async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(' '.repeat(100000)));
      controller.enqueue(new TextEncoder().encode('ä'));
    },
    cancel,
  });
  const input = new Request(request(), { body, duplex: 'half' } as RequestInit);
  expect(input.headers.has('content-length')).toBe(false);
  expect((await appTranslationServiceHandler(input)).status).toBe(413);
  expect(cancel).toHaveBeenCalledOnce();
  expect(state.verify).not.toHaveBeenCalled();
  expect(state.translate).not.toHaveBeenCalled();
});

it('verifies signed service tokens against the configured issuer and audience before subject authorization', async () => {
  const { verifyServiceJwt } =
    await vi.importActual<typeof import('./service-token.js')>('./service-token.js');
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keys = createLocalJWKSet({ keys: [{ ...jwk, kid: 'pilot', alg: 'RS256', use: 'sig' }] });
  state.verify.mockImplementation((token, config) => verifyServiceJwt(token, config, keys));
  const now = Math.floor(Date.now() / 1000);
  for (const [overrides, status] of [
    [{}, 200],
    [{ sub: 'human' }, 403],
    [{ azp: 'other-client' }, 403],
    [{ audience: 'account' }, 401],
    [{ issuer: 'https://identity.example/realms/other' }, 401],
    [{ expires: now - 60 }, 401],
  ] as const) {
    const claims = {
      ...binding,
      sub: binding.subject,
      azp: binding.clientId,
      expires: now + 60,
      ...overrides,
    };
    const token = await new SignJWT({ sub: claims.sub, azp: claims.azp })
      .setProtectedHeader({ alg: 'RS256', kid: 'pilot' })
      .setIssuer(claims.issuer)
      .setAudience(claims.audience)
      .setExpirationTime(claims.expires)
      .sign(privateKey);
    state.translate.mockClear();
    const response = await appTranslationServiceHandler(
      new Request(request(), {
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      })
    );
    expect(response.status).toBe(status);
    expect(state.translate).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
  }
});

it('reports an unavailable identity provider without attempting translation', async () => {
  state.verify.mockRejectedValue(new TypeError('fetch failed'));
  const response = await appTranslationServiceHandler(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: 'service_unavailable', retryable: true });
  expect(state.translate).not.toHaveBeenCalled();
});

it.each([false, true])('compares database timestamp values (changed: %s)', async (changed) => {
  const timestamp = '2026-10-27T12:00:00.000Z';
  connection.updatedAt = timestamp;
  provider.updatedAt = timestamp;
  state.load.mockImplementation(async (_instance, type) => {
    const record = type === 'sva_mainserver' ? connection : provider;
    return { ...record, updatedAt: new Date(record.updatedAt as string) };
  });
  state.translate.mockImplementation(async () => {
    if (changed) provider.updatedAt = '2026-10-27T12:00:00.001Z';
    return ['News', '<p>Hello</p>'];
  });
  const response = await appTranslationServiceHandler(request());
  expect(response.status).toBe(changed ? 403 : 200);
  if (changed) expect(await response.json()).not.toHaveProperty('entries');
});

it.each(['language', 'credential', 'generation', 'binding'])(
  'discards an in-flight result after a change to %s',
  async (change) => {
    state.translate.mockImplementation(async () => {
      if (change === 'language')
        provider.publicConfig = { ...(provider.publicConfig as object), selectedLocales: [] };
      if (change === 'credential')
        provider.publicConfig = { ...(provider.publicConfig as object), credentialRevision: '2' };
      if (change === 'generation') state.query.mockResolvedValue({ rows: [{ generation: '2' }] });
      if (change === 'binding')
        connection.publicConfig = { translationService: { ...binding, subject: 'replacement' } };
      return ['News', '<p>Hello</p>'];
    });
    const response = await appTranslationServiceHandler(request());
    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty('entries');
  }
);

it.each(['disconnect', 'deadline'])(
  'discards provider results after %s and propagates the abort signal',
  async (reason) => {
    vi.useFakeTimers();
    const controller = new AbortController();
    state.translate.mockImplementation(async (_provider, _target, _values, signal: AbortSignal) => {
      if (reason === 'disconnect') controller.abort();
      else await vi.advanceTimersByTimeAsync(35000);
      expect(signal.aborted).toBe(true);
      return ['News', '<p>Hello</p>'];
    });
    const response = await appTranslationServiceHandler(
      new Request(request(), { signal: controller.signal })
    );
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('entries');
  }
);

const testDatabaseUrl = process.env.APP_TRANSLATIONS_TEST_DATABASE_URL;
it.skipIf(!testDatabaseUrl)(
  'checks the real access query and tenant RLS in a disposable local database',
  async () => {
    if (!testDatabaseUrl) throw new Error('disposable_local_test_database_required');
    const url = new URL(testDatabaseUrl);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test'))
      throw new Error('disposable_local_test_database_required');
    const client = new Client({ connectionString: testDatabaseUrl });
    try {
      await client.connect();
      await client.query('BEGIN');
      await client.query(`INSERT INTO iam.instances(id,display_name,primary_hostname,tenant_admin_client_id,auth_realm,auth_client_id)
      VALUES ('de-town','Pilot','de-town.test','tenant-admin','de-town','studio'),
             ('de-other','Other','de-other.test','tenant-admin','de-other','studio')`);
      await client.query(`INSERT INTO iam.instance_modules(instance_id,module_id)
      VALUES ('de-town','app-translations'),('de-other','app-translations')`);
      await client.query(`INSERT INTO iam.instance_plugin_lifecycle(instance_id,plugin_id)
      VALUES ('de-town','app-translations'),('de-other','app-translations')`);
      await client.query('SET LOCAL ROLE iam_app');
      state.query.mockImplementation((sql, values) => client.query(sql, values));
      expect((await appTranslationServiceHandler(request())).status).toBe(200);
      const foreign = await client.query(
        "SELECT instance_id FROM iam.instance_plugin_lifecycle WHERE instance_id='de-other'"
      );
      expect(foreign.rows).toEqual([]);
      for (const update of [
        "UPDATE iam.instances SET status='suspended' WHERE id='de-town'",
        "UPDATE iam.instances SET status='active' WHERE id='de-town'; UPDATE iam.instance_modules SET effective_active=false WHERE instance_id='de-town'",
        "UPDATE iam.instance_modules SET effective_active=true WHERE instance_id='de-town'; UPDATE iam.instance_plugin_lifecycle SET access_state='suspended' WHERE instance_id='de-town'",
      ]) {
        await client.query('RESET ROLE');
        await client.query(update);
        await client.query('SET LOCAL ROLE iam_app');
        state.translate.mockClear();
        expect((await appTranslationServiceHandler(request())).status).toBe(403);
        expect(state.translate).not.toHaveBeenCalled();
      }
      await client.query('ROLLBACK');
    } finally {
      await client.end();
    }
  }
);
