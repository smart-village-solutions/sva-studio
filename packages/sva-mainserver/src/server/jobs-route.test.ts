import { createJobDefaults as browserDefaults } from './jobs-contract.js';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type JobRecord } from './jobs-contract.js';
import { jobFingerprint } from './jobs-snapshot.js';
import type { EffectivePermission } from '@sva/iam-core';
import { jobActorFixture } from './jobs-test-fixture.js';
import { JobPrewriteError } from './service-internals/service-jobs.js';

const state = vi.hoisted(() => ({
  deny: new Set<string>(),
  principal: 'user' as 'user' | 'organization',
  organizationId: undefined as string | undefined,
  realMedia: false,
  sessionPermissions: [] as EffectivePermission[],
  permissions: vi.fn(),
  audit: vi.fn(),
  csrf: false,
  credential: 'credential-1',
  identity: vi.fn(),
  lock: vi.fn(),
  locks: new Map<string, Promise<void>>(),
  entries: new Map<string, { hash: string; body?: unknown }>(),
  remove: vi.fn(),
  verifyDeleted: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  write: vi.fn(),
  prepare: vi.fn(),
  recover: vi.fn(),
  finalize: vi.fn(),
  categories: vi.fn(),
  resourceAccess: vi.fn(),
  authorizeExisting: vi.fn(),
  replaceReferences: vi.fn(),
  asset: vi.fn(),
}));
const actor = () =>
  jobActorFixture({
    principal: state.principal,
    organizationId: state.organizationId,
    credential: state.credential,
  });
vi.mock('@sva/auth-runtime/server', async (original) => {
  const actual = await original<typeof import('@sva/auth-runtime/server')>();
  return {
    authorizeMainserverCreatePrincipal: actual.authorizeMainserverCreatePrincipal,
    resolveEffectivePermissions: (input: unknown) => state.permissions(input),
    withAuthenticatedUser: (_request: Request, callback: (ctx: unknown) => unknown) =>
      callback({ sessionId: 'session-1', user: { instanceId: 'tenant-1', id: 'subject-1' } }),
    authorizeContentPrimitiveForUser: ({ action }: { action: string }) =>
      Promise.resolve(
        state.deny.has(action)
          ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
          : { ok: true, actor: { instanceId: 'tenant-1', keycloakSubject: 'subject-1' } }
      ),
    authorizeMediaPrimitiveForUser: (
      input: Parameters<typeof actual.authorizeMediaPrimitiveForUser>[0]
    ) => {
      if (state.realMedia)
        return actual.authorizeMediaPrimitiveForUser({
          ...input,
          permissions: input.permissions ?? state.sessionPermissions,
        });
      return Promise.resolve(
        state.deny.has(input.action)
          ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
          : { ok: true, actor: { instanceId: 'tenant-1' } }
      );
    },
    validateCsrf: () => (state.csrf ? {} : null),
    withExternalContentMutationLock: (input: unknown) => state.lock(input),
    withMediaService: (_id: string, callback: (service: unknown) => unknown) =>
      callback({
        getAssetById: state.asset,
        listReferencesByTarget: async () => [],
        replaceReferences: state.replaceReferences,
      }),
    reserveIdempotency: async (input: {
      endpoint: string;
      idempotencyKey: string;
      payloadHash: string;
    }) => {
      const key = `${input.endpoint}:${input.idempotencyKey}`;
      const entry = state.entries.get(key);
      if (!entry) {
        state.entries.set(key, { hash: input.payloadHash });
        return { status: 'reserved' };
      }
      if (entry.hash !== input.payloadHash) return { status: 'conflict' };
      return entry.body
        ? { status: 'replay', responseBody: entry.body, responseStatus: 200 }
        : { status: 'conflict' };
    },
    completeIdempotency: async (input: {
      endpoint: string;
      idempotencyKey: string;
      responseBody: unknown;
    }) => {
      const entry = state.entries.get(`${input.endpoint}:${input.idempotencyKey}`);
      if (entry) entry.body = input.responseBody;
    },
  };
});
vi.mock('@sva/server-runtime', async (original) => ({
  ...(await original<typeof import('@sva/server-runtime')>()),
  createSdkLogger: () => ({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));
vi.mock('./mutation-principal-authorization-audit.js', () => ({
  emitMainserverMutationAuthorizationAudit: (input: unknown) => state.audit(input),
}));
vi.mock('./content-route-context.js', () => ({
  withMainserverContextBinding: (response: Response) => response,
}));
vi.mock('./mutation-principal.js', async () => ({
  ...(await import('./mutation-principal-lifecycle.js')),
  resolveMainserverMutationActor: ({ request }: { request: Request }) => ({
    ...actor(),
    operationExternalId: request.headers.get('X-SVA-Operation-Id') ?? actor().operationExternalId,
  }),
  resolveMainserverResourceActor: () => actor(),
  resolveMainserverResourceAccess: (input: unknown) => state.resourceAccess(input),
  authorizeMainserverCreateForPrincipal: async () => ({}),
  authorizeMainserverExistingContent: (input: unknown) => state.authorizeExisting(input),
  finalizeMainserverMutation: (input: unknown) => state.finalize(input),
  recordCreatedMainserverDataProvider: async ({ reread }: { reread: () => Promise<unknown> }) => {
    await reread();
    return { outcome: 'observed' };
  },
}));
vi.mock('./service.js', () => ({
  loadSvaMainserverDataProviderIdentity: (input: unknown) => state.identity(input),
  deleteSvaMainserverJob: (...args: unknown[]) => state.remove(...args),
  verifySvaMainserverJobDeleted: (...args: unknown[]) => state.verifyDeleted(...args),
  listSvaMainserverCategories: (...args: unknown[]) => state.categories(...args),
  listSvaMainserverJobCandidates: (...args: unknown[]) => state.list(...args),
  getSvaMainserverJob: (...args: unknown[]) => state.get(...args),
  prepareSvaMainserverJob: (...args: unknown[]) => state.prepare(...args),
  writeSvaMainserverJob: (...args: unknown[]) => state.write(...args),
  recoverSvaMainserverJob: (...args: unknown[]) => state.recover(...args),
}));
import { dispatchSvaMainserverJobsRequest as dispatch } from './jobs-route.js';

const base = 'https://studio.test/api/v1/mainserver/jobs';
const input = () => ({
  ...browserDefaults('2026-11-01'),
  title: 'Brücke',
  employmentType: 'Vollzeit',
});
const record = (id = '42'): JobRecord => ({
  id,
  title: 'Brücke',
  employmentType: 'Vollzeit',
  genericType: 'Job',
  visible: false,
  updatedAt: '2026-11-01T12:00:00Z',
  input: input(),
  contentFingerprint: 'a'.repeat(64),
  dataProvider: { id: 'provider-1' },
});
const item = {
  id: '42',
  title: 'Brücke',
  employmentType: 'Vollzeit',
  payload: { preserved: true },
};
const request = (body: unknown, id?: string) =>
  new Request(id ? `${base}/${id}` : base, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  state.deny.clear();
  state.principal = 'user';
  state.organizationId = undefined;
  state.realMedia = false;
  state.sessionPermissions = [];
  state.audit.mockResolvedValue(undefined);
  state.permissions.mockImplementation(async () => ({
    ok: true,
    permissions: [
      { action: 'content.publish', resourceType: 'content', accessScope: 'all' },
      { action: 'media.read', resourceType: 'media' },
      { action: 'media.reference.manage', resourceType: 'media' },
    ].filter((permission) => !state.deny.has(permission.action)),
  }));
  state.entries.clear();
  state.locks.clear();
  state.identity.mockResolvedValue({ dataProvider: { id: 'provider-1' } });
  state.lock.mockImplementation(
    async ({
      instanceId,
      referenceId,
      execute,
    }: {
      instanceId: string;
      referenceId: string;
      execute: () => Promise<unknown>;
    }) => {
      const key = `${instanceId}:${referenceId}`;
      const previous = state.locks.get(key) ?? Promise.resolve();
      let release: () => void = () => undefined;
      state.locks.set(
        key,
        new Promise<void>((resolve) => {
          release = resolve;
        })
      );
      await previous;
      try {
        return await execute();
      } finally {
        release();
      }
    }
  );
  state.csrf = false;
  state.credential = 'credential-1';
  state.categories.mockResolvedValue([
    { id: '1', name: 'Verkehr', dataTypes: ['generic_item_job'] },
  ]);
  state.asset.mockResolvedValue({
    visibility: 'public',
    uploadStatus: 'processed',
    processingStatus: 'ready',
    lifecycleStatus: 'active',
  });
  state.list.mockResolvedValue([record()]);
  state.get.mockResolvedValue({ data: record(), item });
  state.prepare.mockImplementation((job, _operationId, existing) => ({
    ...(existing ? { id: existing.id } : {}),
    expected: {
      title: job.title,
      visible: job.visible,
      externalId: job.externalId || `studio-job:${_operationId}`,
    },
    previousMediaIds: [],
    previousVisible: existing?.visible === true,
  }));
  state.remove.mockResolvedValue('42');
  state.verifyDeleted.mockResolvedValue(undefined);
  state.write.mockResolvedValue(record());
  state.recover.mockResolvedValue(record());
  state.finalize.mockResolvedValue(undefined);
  state.resourceAccess.mockImplementation(({ actions }) =>
    Object.fromEntries(actions.map((action: string) => [action, !state.deny.has(action)]))
  );
  state.authorizeExisting.mockImplementation(
    ({ action, additionalActions = [] }: { action: string; additionalActions?: string[] }) =>
      [action, ...additionalActions].some((required) => state.deny.has(required))
        ? new Response(null, { status: 403 })
        : {}
  );
});
describe('jobs HTTP contract', () => {
  it.each([false, true])(
    'serializes competing Job creates with a preceding update=%s for the same external ID',
    async (updating) => {
      let stored: string | undefined;
      let writes = 0;
      state.write.mockImplementation(async ({ prepared }) => {
        const collision = stored;
        await new Promise<void>((resolve) => setImmediate(resolve));
        if (collision) throw new JobPrewriteError('job_external_id_conflict');
        stored = prepared.expected.title;
        writes++;
        return { ...record(), title: stored };
      });
      const firstBody = {
        job: { ...input(), title: 'First', externalId: 'shared' },
        ...(updating ? { baseFingerprint: jobFingerprint(item) } : {}),
      };
      const first = request(firstBody, updating ? '42' : undefined);
      const second = request({ job: { ...input(), title: 'Second', externalId: 'shared' } });
      first.headers.set('X-SVA-Operation-Id', '11111111-1111-4111-8111-111111111111');
      second.headers.set('X-SVA-Operation-Id', '22222222-2222-4222-8222-222222222222');
      const responses = await Promise.all([dispatch(first), dispatch(second)]);
      expect(responses.filter((response) => response?.ok)).toHaveLength(1);
      expect(responses.filter((response) => response?.status === 409)).toHaveLength(1);
      expect(writes).toBe(1);
      const winner = responses.find((response) => response?.ok);
      expect((await winner?.json()).data.title).toBe(stored);
      const keys = state.lock.mock.calls.map(([lock]) => lock.referenceId);
      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(1);
      expect(keys[0]).not.toContain('shared');
    }
  );
  it('uses the same provider lock for create and delete', async () => {
    const create = request({ job: input() });
    create.headers.set('X-SVA-Operation-Id', '11111111-1111-4111-8111-111111111111');
    expect((await dispatch(create))?.status).toBe(201);
    const remove = new Request(`${base}/42`, {
      method: 'DELETE',
      headers: { 'X-SVA-Operation-Id': '22222222-2222-4222-8222-222222222222' },
      body: JSON.stringify({ baseFingerprint: 'a'.repeat(64) }),
    });
    expect((await dispatch(remove))?.status).toBe(200);
    expect(state.lock.mock.calls[0]?.[0].referenceId).toBe(
      state.lock.mock.calls[1]?.[0].referenceId
    );
  });
  it('separates provider locks while retaining one key across operations and credentials', async () => {
    const keys: string[] = [];
    for (const [index, provider] of ['provider-1', 'provider-1', 'provider-2'].entries()) {
      state.identity.mockResolvedValue({ dataProvider: { id: provider } });
      state.credential = `credential-${index}`;
      const call = request({ job: { ...input(), externalId: `external-${index}` } });
      call.headers.set('X-SVA-Operation-Id', `0000000${index}-0000-4000-8000-000000000000`);
      expect((await dispatch(call))?.status).toBe(201);
      keys.push(state.lock.mock.calls[index]?.[0].referenceId);
    }
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
    expect(keys[0]).not.toContain('provider-1');
  });
  it('rejects an unavailable create provider identity before reserving or writing', async () => {
    state.identity.mockRejectedValueOnce(new Error('identity down'));
    const response = await dispatch(request({ job: input() }));
    expect(response?.status).toBe(502);
    expect(await response?.json()).toMatchObject({ error: 'job_prewrite_failed' });
    expect(state.entries.size).toBe(0);
    expect(state.lock).not.toHaveBeenCalled();
    expect(state.write).not.toHaveBeenCalled();
  });
  it('does not claim unrelated routes and rejects an unconfirmed delete', async () => {
    expect(await dispatch(new Request('https://studio.test/other'))).toBeNull();
    expect((await dispatch(new Request(`${base}/42`, { method: 'DELETE' })))?.status).toBe(400);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('requires the exact plugin right and CSRF before any provider write', async () => {
    state.deny.add('jobs.create');
    expect((await dispatch(request({ job: input() })))?.status).toBe(403);
    state.deny.clear();
    state.csrf = true;
    expect((await dispatch(request({ job: input() })))?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('validates fields and requires publication permission for visible creation', async () => {
    expect((await dispatch(request({ job: { ...input(), title: '' } })))?.status).toBe(400);
    state.deny.add('content.publish');
    expect((await dispatch(request({ job: { ...input(), visible: true } })))?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('requires a complete matching baseline for updates', async () => {
    expect((await dispatch(request({ job: input() }, '42')))?.status).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
    const response = await dispatch(
      request({ job: input(), baseFingerprint: jobFingerprint(item) }, '42')
    );
    expect(response?.status).toBe(200);
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('identifies a failed preparation as safe to retry before reserving or writing', async () => {
    state.prepare.mockImplementationOnce(() => {
      throw new Error('upstream unavailable');
    });
    const response = await dispatch(request({ job: input() }));
    expect(response?.status).toBe(502);
    expect(await response?.json()).toMatchObject({ error: 'job_prewrite_failed' });
    expect(state.entries.size).toBe(0);
    expect(state.write).not.toHaveBeenCalled();
    expect((await dispatch(request({ job: input() })))?.status).toBe(201);
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('retains a durable expectation and recovers a lost response without repeating the write', async () => {
    const body = { job: input() };
    state.write.mockRejectedValueOnce(new Error('response_lost'));
    expect((await dispatch(request(body)))?.status).toBe(409);
    const response = await dispatch(
      request({
        recover: true,
        inputHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      })
    );
    expect(response?.status).toBe(201);
    expect(state.write).toHaveBeenCalledTimes(1);
    expect(state.recover).toHaveBeenCalledTimes(1);
  });
  it('recovers a create-only operation with object authorization and no second provider write', async () => {
    state.deny.add('jobs.read');
    const body = { job: input() };
    state.write.mockRejectedValueOnce(new Error('response_lost'));
    expect((await dispatch(request(body)))?.status).toBe(409);
    const recovery = {
      recover: true,
      inputHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    };
    expect((await dispatch(request(recovery)))?.status).toBe(201);
    expect(state.authorizeExisting).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'jobs.create',
        contentType: 'jobs.job',
        contentId: '42',
        item: expect.objectContaining({ dataProvider: { id: 'provider-1' } }),
      })
    );
    state.authorizeExisting.mockReturnValue(new Response(null, { status: 403 }));
    expect((await dispatch(request(recovery)))?.status).toBe(403);
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('binds recovery to the original identity context', async () => {
    const body = { job: input() };
    await dispatch(request(body));
    state.credential = 'changed-context';
    const response = await dispatch(
      request({
        recover: true,
        inputHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      })
    );
    expect(response?.status).toBe(409);
    expect(state.recover).not.toHaveBeenCalled();
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('reports provider success plus local follow-up failure separately', async () => {
    state.finalize.mockRejectedValueOnce(new Error('local_failure'));
    const response = await dispatch(request({ job: input() }));
    expect(response?.status).toBe(202);
    expect(await response?.json()).toMatchObject({
      data: { id: '42', reconciliationRequired: true },
      meta: { reconciliationStatus: 'reconciliation_required' },
    });
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('retains provider success when both local journal finalizations fail', async () => {
    state.finalize.mockRejectedValue(new Error('journal unavailable'));
    const response = await dispatch(request({ job: input() }));
    expect(response?.status).toBe(202);
    expect(await response?.json()).toMatchObject({
      data: { id: '42', reconciliationRequired: true },
    });
    expect(state.write).toHaveBeenCalledTimes(1);
    expect(state.finalize).toHaveBeenCalledTimes(2);
  });
  it('retains an uncertain write when its failure cannot be journaled', async () => {
    state.write.mockRejectedValueOnce(new TypeError('lost response'));
    state.finalize.mockRejectedValue(new Error('journal unavailable'));
    const response = await dispatch(request({ job: input() }));
    expect(response?.status).toBe(409);
    expect(await response?.json()).toMatchObject({ error: 'job_outcome_unknown' });
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('authorizes records before applying the page window', async () => {
    state.list.mockResolvedValue(
      Array.from({ length: 27 }, (_, index) => record(String(index + 1)))
    );
    state.resourceAccess.mockImplementation(({ item: current, actions }) =>
      Object.fromEntries(actions.map((action: string) => [action, current.id !== '27']))
    );
    const response = await dispatch(new Request(`${base}?page=2&pageSize=25`));
    expect(await response?.json()).toMatchObject({
      pagination: { total: 26, page: 2 },
      data: [expect.objectContaining({ id: expect.any(String) })],
    });
  });
  it('returns detail access metadata and never exposes an unreadable construction record', async () => {
    const response = await dispatch(new Request(`${base}/42`));
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      data: { id: '42' },
      meta: { access: { 'jobs.read': true, 'jobs.update': true } },
    });
    state.resourceAccess.mockReturnValueOnce({
      'jobs.read': false,
      'jobs.update': true,
    });
    const denied = await dispatch(new Request(`${base}/42`));
    expect(denied?.status).toBe(403);
    expect(await denied?.json()).not.toHaveProperty('data');
    expect(state.write).not.toHaveBeenCalled();
  });
  it.each([
    ['search=brücke&employmentType=Vollzeit&visible=false', 1],
    ['search=Andere', 0],
    ['employmentType=Andere', 0],
    ['visible=true', 0],
  ] as const)('applies Job filters before pagination: %s', async (query, total) => {
    const response = await dispatch(new Request(`${base}?${query}`));
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ pagination: { total, page: 1 } });
    expect(state.write).not.toHaveBeenCalled();
  });
  it('checks host media read/reference rights and readiness before writing and rechecks them during recovery', async () => {
    const job = {
      ...input(),
      mediaContents: [
        {
          contentType: 'image',
          hostMediaAssetId: '40000000-0000-4000-8000-000000000001',
          sourceUrl: { url: 'https://cdn.test/image.png', description: '' },
          captionText: '',
          copyright: '',
        },
      ],
    };
    state.deny.add('media.reference.manage');
    expect((await dispatch(request({ job })))?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
    state.deny.clear();
    state.deny.add('media.read');
    expect((await dispatch(request({ job })))?.status).toBe(403);
    state.deny.clear();
    state.asset.mockResolvedValueOnce({ visibility: 'private' });
    expect((await dispatch(request({ job })))?.status).toBe(409);
    const provisional = {
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      lifecycleStatus: 'provisional',
    };
    state.asset.mockResolvedValueOnce(provisional);
    expect((await dispatch(request({ job })))?.status).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
    state.write.mockResolvedValue({ ...record(), input: job });
    state.recover.mockResolvedValue({ ...record(), input: job });
    expect((await dispatch(request({ job })))?.status).toBe(201);
    expect(state.replaceReferences).toHaveBeenCalledTimes(1);
    const hash = createHash('sha256').update(JSON.stringify({ job })).digest('hex');
    state.asset.mockResolvedValueOnce(provisional);
    expect((await dispatch(request({ recover: true, inputHash: hash })))?.status).toBe(409);
    expect(state.replaceReferences).toHaveBeenCalledTimes(1);
    state.deny.add('media.read');
    expect((await dispatch(request({ recover: true, inputHash: hash })))?.status).toBe(403);
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('requires delete permission and a fresh fingerprint, then clears media references after confirmed absence', async () => {
    const remove = (body: unknown) =>
      new Request(`${base}/42`, { method: 'DELETE', body: JSON.stringify(body) });
    state.deny.add('jobs.delete');
    expect((await dispatch(remove({ baseFingerprint: 'a'.repeat(64) })))?.status).toBe(403);
    state.deny.clear();
    expect((await dispatch(remove({ baseFingerprint: 'b'.repeat(64) })))?.status).toBe(409);
    expect(state.remove).not.toHaveBeenCalled();
    expect((await dispatch(remove({ baseFingerprint: 'a'.repeat(64) })))?.status).toBe(200);
    expect(state.remove).toHaveBeenCalledTimes(1);
    expect(state.replaceReferences).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'jobs.job', targetId: '42', references: [] })
    );
  });
  it('reconciles an uncertain delete only by reading and cannot change credentials during recovery', async () => {
    const body = { baseFingerprint: 'a'.repeat(64) };
    const remove = (value: unknown) =>
      new Request(`${base}/42`, { method: 'DELETE', body: JSON.stringify(value) });
    state.remove.mockRejectedValueOnce(new Error('lost response'));
    expect((await dispatch(remove(body)))?.status).toBe(409);
    const recovery = {
      recover: true,
      inputHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    };
    expect((await dispatch(remove(recovery)))?.status).toBe(200);
    expect(state.verifyDeleted).toHaveBeenCalledTimes(1);
    expect(state.remove).toHaveBeenCalledTimes(1);
    state.credential = 'another';
    expect((await dispatch(remove(recovery)))?.status).toBe(409);
    expect(state.verifyDeleted).toHaveBeenCalledTimes(1);
  });
});

describe('selected Job mutation principal', () => {
  it('rejects visible organization creates when only own publication is granted', async () => {
    state.principal = 'organization';
    state.organizationId = 'organization-1';
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [{ action: 'content.publish', resourceType: 'content', accessScope: 'own' }],
    });
    const response = await dispatch(request({ job: { ...input(), visible: true } }));
    expect(response?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'content.publish',
        allowed: false,
        actor: expect.objectContaining({ actingPrincipalType: 'organization' }),
      })
    );
  });
  it('retains the host rule that organization grants also allow own content', async () => {
    state.principal = 'user';
    state.organizationId = 'organization-1';
    state.permissions.mockResolvedValue({
      ok: true,
      permissions: [
        { action: 'content.publish', resourceType: 'content', accessScope: 'organization' },
      ],
    });
    expect((await dispatch(request({ job: { ...input(), visible: true } })))?.status).toBe(201);
    expect(state.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'content.publish',
        allowed: true,
        actor: expect.objectContaining({ actingPrincipalType: 'user' }),
      })
    );
  });
  const mediaJob = () => ({
    ...input(),
    mediaContents: [
      {
        contentType: 'image',
        hostMediaAssetId: '10000000-0000-4000-8000-000000000001',
        sourceUrl: { url: 'https://example.org/photo.jpg', description: '' },
        captionText: '',
        copyright: '',
      },
    ],
  });
  const mediaPermissions: EffectivePermission[] = [
    { action: 'media.read', resourceType: 'media' },
    { action: 'media.reference.manage', resourceType: 'media' },
  ];
  it('does not use personal media grants for an organization mutation', async () => {
    state.principal = 'organization';
    state.organizationId = 'organization-1';
    state.realMedia = true;
    state.sessionPermissions = mediaPermissions;
    state.permissions.mockResolvedValue({ ok: true, permissions: [] });
    expect((await dispatch(request({ job: mediaJob() })))?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('accepts organization media grants without requiring personal media grants', async () => {
    state.principal = 'organization';
    state.organizationId = 'organization-1';
    state.realMedia = true;
    state.permissions.mockResolvedValue({ ok: true, permissions: mediaPermissions });
    expect((await dispatch(request({ job: mediaJob() })))?.status).toBe(201);
    expect(state.permissions).toHaveBeenCalledWith({
      instanceId: 'tenant-1',
      keycloakSubject: 'subject-1',
      organizationId: 'organization-1',
    });
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('fails closed before writing if actor permission resolution is unavailable', async () => {
    state.principal = 'organization';
    state.organizationId = 'organization-1';
    state.realMedia = true;
    state.sessionPermissions = mediaPermissions;
    state.permissions.mockResolvedValue({ ok: false, error: 'database_unavailable' });
    expect((await dispatch(request({ job: mediaJob() })))?.status).toBe(503);
    expect(state.write).not.toHaveBeenCalled();
  });
  it.each(['user', 'organization'] as const)(
    'permits visible creation for the matching %s scope',
    async (principal) => {
      state.principal = principal;
      state.organizationId = 'organization-1';
      state.permissions.mockResolvedValue({
        ok: true,
        permissions: [
          {
            action: 'content.publish',
            resourceType: 'content',
            accessScope: principal === 'user' ? 'own' : 'organization',
          },
        ],
      });
      expect((await dispatch(request({ job: { ...input(), visible: true } })))?.status).toBe(201);
      expect(state.write).toHaveBeenCalledTimes(1);
    }
  );
  it('does not require publication rights for a hidden create', async () => {
    state.permissions.mockResolvedValue({ ok: true, permissions: [] });
    expect((await dispatch(request({ job: input() })))?.status).toBe(201);
    expect(state.permissions).not.toHaveBeenCalled();
  });
  it('rechecks publication for recovery before reading or writing the provider', async () => {
    const body = { job: { ...input(), visible: true } };
    state.write.mockRejectedValueOnce(new TypeError('lost response'));
    expect((await dispatch(request(body)))?.status).toBe(409);
    state.permissions.mockResolvedValue({ ok: true, permissions: [] });
    const inputHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    expect((await dispatch(request({ recover: true, inputHash })))?.status).toBe(403);
    expect(state.write).toHaveBeenCalledTimes(1);
    expect(state.recover).not.toHaveBeenCalled();
  });
  it.each([
    [false, true, 'content.publish'],
    [true, false, 'content.changeStatus'],
  ] as const)(
    'retains %s → %s lifecycle authorization during update recovery',
    async (before, after, action) => {
      const original = { ...item, visible: before };
      state.get.mockResolvedValue({ data: { ...record(), visible: before }, item: original });
      state.write.mockRejectedValueOnce(new TypeError('lost response'));
      const body = {
        job: { ...input(), visible: after },
        baseFingerprint: jobFingerprint(original),
      };
      expect((await dispatch(request(body, '42')))?.status).toBe(409);
      state.get.mockResolvedValue({
        data: { ...record(), visible: after },
        item: { ...original, visible: after },
      });
      state.deny.add(action);
      const recovery = {
        recover: true,
        inputHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      };
      expect((await dispatch(request(recovery, '42')))?.status).toBe(403);
      expect(state.recover).not.toHaveBeenCalled();
      expect(state.replaceReferences).not.toHaveBeenCalled();
      state.deny.delete(action);
      expect((await dispatch(request(recovery, '42')))?.status).toBe(200);
      expect(state.authorizeExisting).toHaveBeenCalledWith(
        expect.objectContaining({ additionalActions: [action] })
      );
      expect(state.write).toHaveBeenCalledTimes(1);
    }
  );
  it.each([false, true])(
    'does not add a lifecycle requirement to an unchanged %s update',
    async (visible) => {
      const original = { ...item, visible };
      state.get.mockResolvedValue({ data: { ...record(), visible }, item: original });
      state.deny.add('content.publish');
      state.deny.add('content.changeStatus');
      state.write.mockRejectedValueOnce(new TypeError('lost response'));
      const body = { job: { ...input(), visible }, baseFingerprint: jobFingerprint(original) };
      expect((await dispatch(request(body, '42')))?.status).toBe(409);
      const recovery = {
        recover: true,
        inputHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
      };
      expect((await dispatch(request(recovery, '42')))?.status).toBe(200);
      expect(state.write).toHaveBeenCalledTimes(1);
    }
  );
  it('does not complete recovery when its saved original visibility is missing', async () => {
    const body = { job: input(), baseFingerprint: jobFingerprint(item) };
    state.write.mockRejectedValueOnce(new TypeError('lost response'));
    expect((await dispatch(request(body, '42')))?.status).toBe(409);
    const saved = [...state.entries.values()].find((entry) => entry.body);
    if (!saved) throw new Error('missing expectation');
    saved.body = Object.fromEntries(
      Object.entries(saved.body as Record<string, unknown>).filter(
        ([key]) => key !== 'previousVisible'
      )
    );
    const recovery = {
      recover: true,
      inputHash: createHash('sha256').update(JSON.stringify(body)).digest('hex'),
    };
    expect((await dispatch(request(recovery, '42')))?.status).toBe(502);
    expect(state.recover).not.toHaveBeenCalled();
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('rechecks actor media rights on recovery without issuing another provider mutation', async () => {
    state.principal = 'organization';
    state.organizationId = 'organization-1';
    state.realMedia = true;
    state.permissions.mockResolvedValue({ ok: true, permissions: mediaPermissions });
    state.write.mockRejectedValueOnce(new TypeError('lost response'));
    const job = mediaJob();
    const body = { job };
    expect((await dispatch(request(body)))?.status).toBe(409);
    state.sessionPermissions = mediaPermissions;
    state.permissions.mockResolvedValue({ ok: true, permissions: [] });
    state.recover.mockResolvedValue({ ...record(), input: job });
    const inputHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    expect((await dispatch(request({ recover: true, inputHash })))?.status).toBe(403);
    expect(state.write).toHaveBeenCalledTimes(1);
    expect(state.replaceReferences).not.toHaveBeenCalled();
  });
  it.each(['media.read', 'media.reference.manage'])(
    'requires actor-bound %s for an existing Job update',
    async (action) => {
      state.principal = 'organization';
      state.organizationId = 'organization-1';
      state.realMedia = true;
      state.sessionPermissions = mediaPermissions;
      state.permissions.mockResolvedValue({
        ok: true,
        permissions: mediaPermissions.filter((permission) => permission.action !== action),
      });
      expect(
        (await dispatch(request({ job: mediaJob(), baseFingerprint: jobFingerprint(item) }, '42')))
          ?.status
      ).toBe(403);
      expect(state.write).not.toHaveBeenCalled();
    }
  );
});
