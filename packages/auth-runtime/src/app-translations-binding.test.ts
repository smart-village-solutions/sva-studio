import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
  query: vi.fn(),
  url: vi.fn(),
  credentials: vi.fn(),
}));
vi.mock('./mainserver-effective-credentials.js', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus: state.credentials,
}));
vi.mock('@sva/data-repositories/server', () => ({
  loadDefaultExternalInterfaceRecord: state.load,
  saveMainserverTranslationServiceBinding: state.save,
}));
vi.mock('./db.js', () => ({
  withIamAppDb: (work: (client: unknown) => unknown) => work({ query: state.query }),
}));
vi.mock('./upstream-url-validation.js', () => ({ normalizePublicUpstreamUrl: state.url }));
import { Client } from 'pg';
import type { StudioJobExecutionHandlerContext } from './plugin-operations/types.js';
import {
  reconcileAppTranslationServiceBinding,
  readAppTranslationServiceBinding,
} from './app-translations-binding.js';
const context = () =>
  ({
    job: { id: '11111111-1111-4111-8111-111111111111', instanceId: 'de-town' },
    tenantLifecycle: { operation: 'provision', generation: 1 },
  }) as StudioJobExecutionHandlerContext;
const binding = {
  issuer: 'https://identity.example/realms/demo',
  audience: 'sva-studio-app-translations',
  clientId: 'main',
  subject: 'service-subject',
};
const metadata = () => ({
  schemaVersion: 1,
  instanceId: 'de-town',
  studioUrl: 'https://de-town.studio.example/api/v1/app-translations/translate',
  binding,
});
let connection: {
  id: string;
  instanceId: string;
  enabled: boolean;
  publicConfig: Record<string, unknown>;
};
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('SVA_PUBLIC_BASE_URL', 'https://studio.example');
  connection = {
    id: 'main',
    instanceId: 'de-town',
    enabled: true,
    publicConfig: {
      graphqlBaseUrl: 'https://town.main.example/graphql',
      oauthTokenUrl: 'https://town.main.example/oauth/token',
    },
  };
  state.load.mockResolvedValue(connection);
  state.query.mockResolvedValue({
    rows: [
      { primary_hostname: 'de-town.studio.example', generation: '1', assignment_revision: '123' },
    ],
  });
  state.url.mockImplementation(async (url: string) => url);
  state.save.mockResolvedValue(true);
  state.credentials.mockResolvedValue({ status: 'missing_credentials' });
  fetcher = vi.fn().mockImplementation(async () => Response.json(metadata()));
  vi.stubGlobal('fetch', fetcher);
});
it('discovers only from the registered Mainserver and saves the confirmed binding', async () => {
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(true);
  expect(fetcher).toHaveBeenCalledWith(
    'https://town.main.example/api/v1/app_translations/service_identity',
    expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) })
  );
  expect(state.save).toHaveBeenCalledWith(
    expect.objectContaining({
      connection,
      binding,
      generation: '1',
      hostname: 'de-town.studio.example',
    })
  );
});
it.each([
  'instance',
  'destination',
  'audience',
  'secret',
  'http',
  'oversize',
  'unavailable',
  'private',
  'private-issuer',
  'conflict',
])('does not authorize invalid or conflicting discovery: %s', async (change) => {
  const data = metadata();
  if (change === 'instance') data.instanceId = 'de-other';
  if (change === 'destination')
    data.studioUrl = 'https://other.studio.example/api/v1/app-translations/translate';
  if (change === 'audience') data.binding = { ...binding, audience: 'account' };
  if (change === 'secret') Object.assign(data, { access_token: 'not-accepted' });
  if (change === 'http') data.binding = { ...binding, issuer: 'http://identity.example' };
  if (change === 'conflict')
    connection.publicConfig.translationService = { ...binding, subject: 'manual-other' };
  if (change === 'private') state.url.mockResolvedValue(null);
  if (change === 'private-issuer')
    state.url.mockImplementation(async (url: string) => (url === binding.issuer ? null : url));
  fetcher.mockImplementation(async () =>
    change === 'oversize'
      ? new Response('x'.repeat(8193))
      : change === 'unavailable'
        ? new Response('', { status: 503 })
        : Response.json(data)
  );
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
  expect(state.save).not.toHaveBeenCalled();
});
it('does not fetch for disabled, absent or inactive assignments', async () => {
  connection.enabled = false;
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
  state.load.mockResolvedValue(null);
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
  state.load.mockResolvedValue({ ...connection, enabled: true });
  state.query.mockResolvedValue({ rows: [] });
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});
it('does not report success when the assignment or module changed during discovery', async () => {
  state.save.mockResolvedValue(false);
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('accepts the configured central Studio service endpoint while retaining the tenant identity check', async () => {
  fetcher.mockImplementation(async () =>
    Response.json({
      ...metadata(),
      studioUrl: 'https://studio.example/api/v1/app-translations/translate',
    })
  );
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(true);
  fetcher.mockImplementation(async () =>
    Response.json({
      ...metadata(),
      instanceId: 'de-other',
      studioUrl: 'https://studio.example/api/v1/app-translations/translate',
    })
  );
  state.save.mockClear();
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
  expect(state.save).not.toHaveBeenCalled();
});
it.each(['readiness', 'suspend'])('does not enroll identities from a %s job', async (operation) => {
  const job = context();
  Object.assign(job.tenantLifecycle!, { operation });
  expect(await reconcileAppTranslationServiceBinding(job)).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});

it('does not save a binding when the discovery deadline aborts a pending response stream', async () => {
  const deadline = new AbortController();
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  fetcher.mockImplementation(
    async (_url: string, options: RequestInit) =>
      new Response(
        new ReadableStream({
          start(controller) {
            options.signal!.addEventListener('abort', () =>
              controller.error(new DOMException('Timed out', 'TimeoutError'))
            );
          },
        })
      )
  );
  try {
    const result = reconcileAppTranslationServiceBinding(context());
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    deadline.abort();
    expect(await result).toBe(false);
    expect(state.save).not.toHaveBeenCalled();
    expect(timeout).toHaveBeenCalledWith(12000);
  } finally {
    timeout.mockRestore();
  }
});

const testDatabaseUrl = process.env.APP_TRANSLATIONS_TEST_DATABASE_URL;
it.skipIf(!testDatabaseUrl)(
  'checks the actual discovery scope under RLS, including the claimed reactivation',
  async () => {
    const url = new URL(testDatabaseUrl!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test'))
      throw new Error('disposable_test_database_required');
    const client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO iam.external_interface_types(type_key,owner_kind,owner_id,display_name,category,public_schema_json,secret_schema_json,status_check_kind)
      VALUES ('sva_mainserver','host','host','Main','api','{}','{}','sva_mainserver') ON CONFLICT DO NOTHING`);
      await client.query(`INSERT INTO iam.instances(id,display_name,primary_hostname,tenant_admin_client_id,auth_realm,auth_client_id)
      VALUES ('de-town','Test','de-town.studio.example','tenant-admin','de-town','studio')`);
      await client.query(
        "INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES ('de-town','app-translations',true)"
      );
      const job = context();
      await client.query(
        `INSERT INTO iam.studio_jobs(id,instance_id,plugin_id,job_type_id,queue_name,status,input_payload,idempotency_key,scheduled_at)
      VALUES ($1::uuid,'de-town','app-translations','app-translations.lifecycle','plugin-operations','running','{}',$1::text,now())`,
        [job.job.id]
      );
      await client.query(
        `INSERT INTO iam.instance_plugin_lifecycle(instance_id,plugin_id,desired_operation,claimed_generation,active_job_id)
      VALUES ('de-town','app-translations','provision',1,$1)`,
        [job.job.id]
      );
      await client.query(
        `INSERT INTO iam.instance_external_interfaces(id,instance_id,type_key,owner_kind,owner_id,display_name,alias,is_default,category,status_check_kind,public_config_json)
      VALUES ('main','de-town','sva_mainserver','host','host','Main','default',true,'api','sva_mainserver',$1)`,
        [JSON.stringify(connection.publicConfig)]
      );
      const organizationId = '11111111-1111-4111-8111-111111111112';
      const accountId = '11111111-1111-4111-8111-111111111113';
      await client.query(
        `INSERT INTO iam.organizations(id,instance_id,organization_key,display_name) VALUES ($1,'de-town','technical','Test')`,
        [organizationId]
      );
      await client.query(
        `INSERT INTO iam.accounts(id,instance_id,keycloak_subject,is_technical_account,status) VALUES ($1,'de-town','technical',true,'active')`,
        [accountId]
      );
      await client.query(
        `INSERT INTO iam.organization_mainserver_credentials(instance_id,organization_id,technical_account_id,provisioning_status,mainserver_application_id,mainserver_application_secret_ciphertext) VALUES ('de-town',$1,$2,'ready','test-client','test-ciphertext')`,
        [organizationId, accountId]
      );
      await client.query('SET LOCAL ROLE iam_app');
      state.query.mockImplementation((sql, values) => client.query(sql, values));
      expect(await reconcileAppTranslationServiceBinding(job)).toBe(true);
      state.credentials.mockResolvedValue({
        status: 'ok',
        source: 'organization',
        credentials: { apiKey: 'technical-client', apiSecret: 'technical-secret' },
      });
      fetcher
        .mockResolvedValueOnce(new Response('', { status: 503 }))
        .mockResolvedValueOnce(Response.json({ access_token: 'setup-token' }))
        .mockResolvedValueOnce(Response.json(metadata()));
      expect(await reconcileAppTranslationServiceBinding(job)).toBe(true);
      expect(state.credentials).toHaveBeenLastCalledWith(
        expect.objectContaining({
          activeOrganizationId: organizationId,
          actingPrincipalType: 'organization',
        })
      );
      state.credentials.mockClear();
      await client.query(`UPDATE iam.accounts SET is_blocked=true WHERE id=$1`, [accountId]);
      fetcher.mockResolvedValueOnce(new Response('', { status: 503 }));
      expect(await reconcileAppTranslationServiceBinding(job)).toBe(false);
      expect(state.credentials).not.toHaveBeenCalled();
      fetcher.mockClear();
      await client.query(
        "UPDATE iam.instance_plugin_lifecycle SET access_state='suspended' WHERE instance_id='de-town'"
      );
      expect(await reconcileAppTranslationServiceBinding(job)).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
      await client.query(
        "UPDATE iam.instance_plugin_lifecycle SET desired_operation='reactivate' WHERE instance_id='de-town'"
      );
      Object.assign(job.tenantLifecycle!, { operation: 'reactivate' });
      expect(await reconcileAppTranslationServiceBinding(job)).toBe(true);
      fetcher.mockClear();
      Object.assign(job.tenantLifecycle!, { generation: 2 });
      expect(await reconcileAppTranslationServiceBinding(job)).toBe(false);
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      await client.query('ROLLBACK');
      await client.end();
    }
  }
);

it('reads binding readiness without network requests or configuration writes', async () => {
  expect(await readAppTranslationServiceBinding('de-town')).toBe(false);
  connection.publicConfig.translationService = binding;
  expect(await readAppTranslationServiceBinding('de-town')).toBe(true);
  connection.enabled = false;
  expect(await readAppTranslationServiceBinding('de-town')).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
  expect(state.save).not.toHaveBeenCalled();
});

const prepareSetup = () => {
  state.query.mockImplementation(async (sql: string) => ({
    rows: sql.includes('organization_mainserver_credentials')
      ? [{ organization_id: 'technical-org' }]
      : [
          {
            primary_hostname: 'de-town.studio.example',
            generation: '1',
            assignment_revision: '123',
          },
        ],
  }));
  state.credentials.mockResolvedValue({
    status: 'ok',
    source: 'organization',
    credentials: { apiKey: 'technical-client', apiSecret: 'technical-secret' },
  });
  fetcher
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(Response.json({ access_token: 'setup-token', token_type: 'Bearer' }))
    .mockResolvedValueOnce(Response.json(metadata()));
};

it.each(['provision', 'reconcile', 'reactivate'])(
  'repairs missing Mainserver setup during %s using only ready organization credentials',
  async (operation) => {
    const job = context();
    Object.assign(job, { tenantLifecycle: { ...job.tenantLifecycle, operation } });
    prepareSetup();
    expect(await reconcileAppTranslationServiceBinding(job)).toBe(true);
    expect(state.credentials).toHaveBeenCalledWith({
      instanceId: 'de-town',
      keycloakSubject: '',
      activeOrganizationId: 'technical-org',
      actingPrincipalType: 'organization',
    });
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      'https://town.main.example/api/v1/app_translations/service_identity',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: expect.objectContaining({ Authorization: 'Bearer setup-token' }),
        body: JSON.stringify({ instanceId: 'de-town', studioUrl: metadata().studioUrl }),
      })
    );
    expect(state.save).toHaveBeenCalledOnce();
  }
);

it('preserves an existing binding without attempting setup when discovery fails', async () => {
  prepareSetup();
  connection.publicConfig.translationService = binding;
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
  expect(state.credentials).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledOnce();
});

it.each([
  'no-organization',
  'missing-credentials',
  'private-oauth',
  'stale-job',
  'invalid-token',
  'failed-setup',
])('does not authorize or complete unsafe setup: %s', async (change) => {
  prepareSetup();
  if (change === 'no-organization')
    state.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('organization_mainserver_credentials')
        ? []
        : [
            {
              primary_hostname: 'de-town.studio.example',
              generation: '1',
              assignment_revision: '123',
            },
          ],
    }));
  if (change === 'missing-credentials')
    state.credentials.mockResolvedValue({ status: 'missing_credentials' });
  if (change === 'private-oauth')
    state.url.mockImplementation(async (url: string) => (url.includes('oauth') ? null : url));
  if (change === 'stale-job')
    state.query.mockImplementation(async (sql: string) => ({
      rows: sql.includes('organization_mainserver_credentials')
        ? [{ organization_id: 'technical-org' }]
        : fetcher.mock.calls.length > 1
          ? []
          : [
              {
                primary_hostname: 'de-town.studio.example',
                generation: '1',
                assignment_revision: '123',
              },
            ],
    }));
  if (change === 'invalid-token' || change === 'failed-setup') {
    fetcher
      .mockReset()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(
        change === 'invalid-token'
          ? Response.json({ access_token: 'x'.repeat(8193) })
          : Response.json({ access_token: 'setup-token' })
      )
      .mockResolvedValueOnce(new Response('', { status: 403 }));
  }
  expect(await reconcileAppTranslationServiceBinding(context())).toBe(false);
  expect(state.save).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(
    change === 'failed-setup' ? 3 : ['stale-job', 'invalid-token'].includes(change) ? 2 : 1
  );
});
