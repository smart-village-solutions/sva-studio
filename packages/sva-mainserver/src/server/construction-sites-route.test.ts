import {
  constructionSiteInputSchema as browserSchema,
  createConstructionSiteDefaults as browserDefaults,
} from '../../../plugin-construction-sites/src/contract.js';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  constructionSiteInputSchema,
  type ConstructionSiteRecord,
} from './construction-sites-contract.js';
import { constructionSiteFingerprint } from './construction-sites-snapshot.js';

const state = vi.hoisted(() => ({
  deny: new Set<string>(),
  csrf: false,
  credential: 'credential-1',
  entries: new Map<string, { hash: string; body?: unknown }>(),
  list: vi.fn(),
  get: vi.fn(),
  write: vi.fn(),
  prepare: vi.fn(),
  recover: vi.fn(),
  finalize: vi.fn(),
  categories: vi.fn(),
  resourceAccess: vi.fn(),
  replaceReferences: vi.fn(),
  asset: vi.fn(),
}));
const actor = () => ({
  instanceId: 'tenant-1',
  keycloakSubject: 'subject-1',
  actorAccountId: 'account-1',
  operationExternalId: '4f392d13-2d02-4c24-845b-109bddbc5ff0',
  actingPrincipalType: 'user',
  credentialFingerprint: state.credential,
  mutationPrincipalContext: { actingPrincipalType: 'user' },
});
vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: (_request: Request, callback: (ctx: unknown) => unknown) =>
    callback({ user: { instanceId: 'tenant-1', id: 'subject-1' } }),
  authorizeContentPrimitiveForUser: ({ action }: { action: string }) =>
    Promise.resolve(
      state.deny.has(action)
        ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
        : { ok: true, actor: { instanceId: 'tenant-1', keycloakSubject: 'subject-1' } }
    ),
  authorizeMediaPrimitiveForUser: ({ action }: { action: string }) =>
    Promise.resolve(
      state.deny.has(action)
        ? { ok: false, status: 403, error: 'forbidden', message: 'forbidden' }
        : { ok: true, actor: { instanceId: 'tenant-1' } }
    ),
  validateCsrf: () => (state.csrf ? {} : null),
  withExternalContentMutationLock: ({ execute }: { execute: () => unknown }) => execute(),
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
}));
vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));
vi.mock('./content-route-context.js', () => ({
  withMainserverContextBinding: (response: Response) => response,
}));
vi.mock('./mutation-principal.js', () => ({
  resolveMainserverMutationActor: () => actor(),
  resolveMainserverResourceActor: () => actor(),
  resolveMainserverResourceAccess: (input: unknown) => state.resourceAccess(input),
  authorizeMainserverCreateForPrincipal: async () => ({}),
  authorizeMainserverExistingContent: async () => ({}),
  finalizeMainserverMutation: (input: unknown) => state.finalize(input),
  recordCreatedMainserverDataProvider: async () => ({ outcome: 'observed' }),
  resolveMainserverVisibilityAction: () => undefined,
  toMainserverAdditionalActions: () => [],
}));
vi.mock('./service.js', () => ({
  listSvaMainserverCategories: (...args: unknown[]) => state.categories(...args),
  listSvaMainserverConstructionSiteCandidates: (...args: unknown[]) => state.list(...args),
  getSvaMainserverConstructionSite: (...args: unknown[]) => state.get(...args),
  prepareSvaMainserverConstructionSite: (...args: unknown[]) => state.prepare(...args),
  writeSvaMainserverConstructionSite: (...args: unknown[]) => state.write(...args),
  recoverSvaMainserverConstructionSite: (...args: unknown[]) => state.recover(...args),
}));
import { dispatchSvaMainserverConstructionSitesRequest as dispatch } from './construction-sites-route.js';

const base = 'https://studio.test/api/v1/mainserver/construction-sites';
const input = () => ({ ...browserDefaults('2026-11-01'), title: 'Brücke' });
const record = (id = '42'): ConstructionSiteRecord => ({
  id,
  title: 'Brücke',
  genericType: 'ConstructionSite',
  visible: false,
  updatedAt: '2026-11-01T12:00:00Z',
  input: input(),
  contentFingerprint: 'a'.repeat(64),
  dataProvider: { id: 'provider-1' },
});
const item = { id: '42', title: 'Brücke', payload: { preserved: true } };
const request = (body: unknown, id?: string) =>
  new Request(id ? `${base}/${id}` : base, {
    method: id ? 'PATCH' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  state.deny.clear();
  state.entries.clear();
  state.csrf = false;
  state.credential = 'credential-1';
  state.categories.mockResolvedValue([
    { id: '1', name: 'Verkehr', dataTypes: ['generic_item_construction_site'] },
  ]);
  state.asset.mockResolvedValue({
    visibility: 'public',
    uploadStatus: 'processed',
    processingStatus: 'ready',
    lifecycleStatus: 'active',
  });
  state.list.mockResolvedValue([record()]);
  state.get.mockResolvedValue({ data: record(), item });
  state.prepare.mockImplementation((site, _operationId, existing) => ({
    ...(existing ? { id: existing.id } : {}),
    expected: { title: site.title, visible: site.visible },
    previousMediaIds: [],
  }));
  state.write.mockResolvedValue(record());
  state.recover.mockResolvedValue(record());
  state.finalize.mockResolvedValue(undefined);
  state.resourceAccess.mockImplementation(({ actions }) =>
    Object.fromEntries(actions.map((action: string) => [action, !state.deny.has(action)]))
  );
});
describe('construction-sites HTTP contract', () => {
  it('does not claim unrelated routes and rejects DELETE', async () => {
    expect(await dispatch(new Request('https://studio.test/other'))).toBeNull();
    expect((await dispatch(new Request(`${base}/42`, { method: 'DELETE' })))?.status).toBe(405);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('requires the exact plugin right and CSRF before any provider write', async () => {
    state.deny.add('construction-sites.create');
    expect((await dispatch(request({ site: input() })))?.status).toBe(403);
    state.deny.clear();
    state.csrf = true;
    expect((await dispatch(request({ site: input() })))?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('validates fields and requires publication permission for visible creation', async () => {
    expect((await dispatch(request({ site: { ...input(), title: '' } })))?.status).toBe(400);
    state.deny.add('content.publish');
    expect((await dispatch(request({ site: { ...input(), visible: true } })))?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
  });
  it('rejects unknown or incompatible new categories before writing', async () => {
    expect(
      (await dispatch(request({ site: { ...input(), categories: [{ name: 'Unknown' }] } })))?.status
    ).toBe(400);
    expect(state.write).not.toHaveBeenCalled();
    expect(
      (await dispatch(request({ site: { ...input(), categories: [{ name: 'Verkehr' }] } })))?.status
    ).toBe(201);
  });
  it('requires a complete matching baseline for updates', async () => {
    expect((await dispatch(request({ site: input() }, '42')))?.status).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
    const response = await dispatch(
      request({ site: input(), baseFingerprint: constructionSiteFingerprint(item) }, '42')
    );
    expect(response?.status).toBe(200);
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('retains a durable expectation and recovers a lost response without repeating the write', async () => {
    const body = { site: input() };
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
  it('binds recovery to the original identity context', async () => {
    const body = { site: input() };
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
    const response = await dispatch(request({ site: input() }));
    expect(response?.status).toBe(202);
    expect(await response?.json()).toMatchObject({
      data: { id: '42', reconciliationRequired: true },
      meta: { reconciliationStatus: 'reconciliation_required' },
    });
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
  it('checks host media read/reference rights and readiness before writing and rechecks them during recovery', async () => {
    const site = {
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
    expect((await dispatch(request({ site })))?.status).toBe(403);
    expect(state.write).not.toHaveBeenCalled();
    state.deny.clear();
    state.deny.add('media.read');
    expect((await dispatch(request({ site })))?.status).toBe(403);
    state.deny.clear();
    state.asset.mockResolvedValueOnce({ visibility: 'private' });
    expect((await dispatch(request({ site })))?.status).toBe(409);
    const provisional = {
      visibility: 'public',
      uploadStatus: 'processed',
      processingStatus: 'ready',
      lifecycleStatus: 'provisional',
    };
    state.asset.mockResolvedValueOnce(provisional);
    expect((await dispatch(request({ site })))?.status).toBe(409);
    expect(state.write).not.toHaveBeenCalled();
    state.write.mockResolvedValue({ ...record(), input: site });
    state.recover.mockResolvedValue({ ...record(), input: site });
    expect((await dispatch(request({ site })))?.status).toBe(201);
    expect(state.replaceReferences).toHaveBeenCalledTimes(1);
    const hash = createHash('sha256').update(JSON.stringify({ site })).digest('hex');
    state.asset.mockResolvedValueOnce(provisional);
    expect((await dispatch(request({ recover: true, inputHash: hash })))?.status).toBe(409);
    expect(state.replaceReferences).toHaveBeenCalledTimes(1);
    state.deny.add('media.read');
    expect((await dispatch(request({ recover: true, inputHash: hash })))?.status).toBe(403);
    expect(state.write).toHaveBeenCalledTimes(1);
  });
  it('keeps client and authoritative server validation compatible across the trust boundary', () => {
    const valid = { ...browserDefaults('2026-11-01'), title: 'Road' };
    for (const value of [
      valid,
      { ...valid, title: '' },
      { ...valid, dates: [{ dateStart: '2026-11-02', dateEnd: '2026-11-01' }] },
      { ...valid, locations: [{ name: 'Zero', latitude: 0, longitude: 0 }] },
      { ...valid, locations: [{ name: 'Partial', latitude: 0, longitude: null }] },
    ]) {
      expect(constructionSiteInputSchema.safeParse(value).success).toBe(
        browserSchema.safeParse(value).success
      );
    }
  });
});
