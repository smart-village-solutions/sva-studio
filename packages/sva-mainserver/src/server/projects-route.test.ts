import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  bindReference: vi.fn(),
  completeIdempotency: vi.fn(),
  listReferences: vi.fn(),
  loadCore: vi.fn(),
  loadReferenceByContentId: vi.fn(),
  loadReferenceByOperation: vi.fn(),
  prepareExternalContent: vi.fn(),
  reserveIdempotency: vi.fn(),
  resolveActorInfo: vi.fn(),
  updateCore: vi.fn(),
  updateReconciliation: vi.fn(),
  validateCsrf: vi.fn(),
  withAuthenticatedUser: vi.fn(),
  withLock: vi.fn(),
  changeVisibility: vi.fn(),
  createGenericItem: vi.fn(),
  getGenericItem: vi.fn(),
  listGenericItems: vi.fn(),
  updateGenericItem: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorize,
  bindExternalContentReference: state.bindReference,
  completeIdempotency: state.completeIdempotency,
  listExternalContentReferences: state.listReferences,
  loadExternalContentCore: state.loadCore,
  loadExternalContentReferenceByContentId: state.loadReferenceByContentId,
  loadExternalContentReferenceByOperation: state.loadReferenceByOperation,
  prepareExternalContent: state.prepareExternalContent,
  reserveIdempotency: state.reserveIdempotency,
  resolveActorInfo: state.resolveActorInfo,
  updateExternalContentCore: state.updateCore,
  updateExternalContentReconciliationStatus: state.updateReconciliation,
  validateCsrf: state.validateCsrf,
  withAuthenticatedUser: state.withAuthenticatedUser,
  withExternalContentMutationLock: state.withLock,
}));

vi.mock('@sva/server-runtime', async () => {
  const actual = await vi.importActual<typeof import('@sva/server-runtime')>('@sva/server-runtime');
  return {
    ...actual,
    createSdkLogger: () => ({ info: state.loggerInfo, warn: state.loggerWarn }),
    getWorkspaceContext: () => ({ requestId: 'request-1', traceId: 'trace-1' }),
  };
});

vi.mock('./service.js', () => ({
  changeSvaMainserverGenericItemVisibility: state.changeVisibility,
  createSvaMainserverGenericItem: state.createGenericItem,
  getSvaMainserverGenericItem: state.getGenericItem,
  listSvaMainserverGenericItems: state.listGenericItems,
  updateSvaMainserverGenericItem: state.updateGenericItem,
}));

import { dispatchSvaMainserverProjectsRequest } from './projects-route.js';

const organizationId = '11111111-1111-4111-8111-111111111111';
const accountId = '22222222-2222-4222-8222-222222222222';
const contentId = '33333333-3333-4333-8333-333333333333';
const referenceId = '44444444-4444-4444-8444-444444444444';

const ctx = {
  sessionId: 'session-1',
  activeOrganizationId: organizationId,
  user: {
    id: 'subject-1',
    instanceId: 'tenant-1',
    roles: ['editor'],
    displayName: 'Redaktion',
  },
};

const core = {
  id: contentId,
  contentType: 'projects.project',
  instanceId: 'tenant-1',
  organizationId,
  ownerUserId: accountId,
  ownerOrganizationId: organizationId,
  title: 'Projekt',
  publishedAt: '2026-01-03T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: accountId,
  updatedAt: '2026-01-02T00:00:00.000Z',
  updatedBy: accountId,
  authorDisplayMode: 'organization' as const,
  author: 'Gemeinde',
  payload: { language: 'de', status: 'published', deleted: false },
  status: 'published' as const,
  validationState: 'valid' as const,
  historyRef: 'history-1',
};

const reference = {
  id: referenceId,
  instanceId: 'tenant-1',
  contentId,
  sourceSystem: 'mainserver',
  sourceEntityType: 'GenericItem',
  sourceEntityId: 'external-1',
  operationExternalId: 'operation-1',
  reconciliationStatus: 'bound' as const,
};

const genericItem = {
  id: 'external-1',
  title: 'Projekt',
  contentType: 'generic-items.generic-item' as const,
  status: 'published' as const,
  genericType: 'PROJECT',
  teaser: 'Kurz',
  visible: true,
  author: 'Gemeinde',
  externalId: 'operation-1',
  payload: { language: 'de', status: 'published', deleted: false },
  categories: [],
  contacts: [],
  webUrls: [],
  addresses: [],
  contentBlocks: [{ body: '<p>Text</p>', mediaContents: [] }],
  openingHours: [],
  priceInformations: [],
  mediaContents: [],
  locations: [],
  dates: [],
  accessibilityInformations: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const input = {
  language: 'de',
  title: 'Projekt',
  description: 'Kurz',
  fullText: '<p>Text</p>',
  images: [],
  status: 'published',
  author: { type: 'organization', id: organizationId, displayName: 'Gemeinde' },
};

const request = (path: string, init?: RequestInit) =>
  new Request(`https://studio.test${path}`, {
    ...init,
    headers: {
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
      ...(init?.headers ?? {}),
    },
  });

const prepareDefaults = () => {
  state.withAuthenticatedUser.mockImplementation((_request, handler) => handler(ctx));
  state.validateCsrf.mockReturnValue(null);
  state.authorize.mockResolvedValue({
    ok: true,
    actor: {
      instanceId: 'tenant-1',
      keycloakSubject: 'subject-1',
      organizationId,
    },
    permissions: [],
  });
  state.resolveActorInfo.mockResolvedValue({
    actor: { instanceId: 'tenant-1', actorAccountId: accountId },
  });
  state.withLock.mockImplementation(({ execute }) => execute());
};

describe('projects route', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('reads every upstream page before joining, filtering and paginating projects', async () => {
    prepareDefaults();
    state.listReferences.mockResolvedValue([reference]);
    state.loadCore.mockResolvedValue(core);
    state.listGenericItems
      .mockResolvedValueOnce({
        data: [{ ...genericItem, genericType: 'INFO' }],
        pagination: { page: 1, pageSize: 100, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        data: [genericItem, { ...genericItem, id: 'deleted', payload: { deleted: true } }],
        pagination: { page: 2, pageSize: 100, hasNextPage: false },
      });

    const response = await dispatchSvaMainserverProjectsRequest(
      request('/api/v1/mainserver/projects?page=1&pageSize=25')
    );

    expect(response?.status).toBe(200);
    await expect(response?.json()).resolves.toEqual({
      data: [expect.objectContaining({ id: contentId, title: 'Projekt' })],
      pagination: { page: 1, pageSize: 25, hasNextPage: false, total: 1 },
    });
    expect(state.listGenericItems).toHaveBeenCalledTimes(2);
  });

  it('creates local core and stable external reference before binding the provider result', async () => {
    prepareDefaults();
    state.loadReferenceByOperation.mockResolvedValue(undefined);
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.prepareExternalContent.mockResolvedValue({ contentId, reference: { ...reference, sourceEntityId: undefined, reconciliationStatus: 'pending' } });
    state.loadCore.mockResolvedValue(core);
    state.createGenericItem.mockResolvedValue(genericItem);
    state.bindReference.mockResolvedValue(reference);

    const response = await dispatchSvaMainserverProjectsRequest(
      request('/api/v1/mainserver/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'operation-1' },
        body: JSON.stringify(input),
      })
    );

    expect(response?.status).toBe(201);
    expect(state.prepareExternalContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'projects.project',
        operationExternalId: 'operation-1',
        status: 'published',
      })
    );
    expect(state.createGenericItem).toHaveBeenCalledWith(
      expect.objectContaining({
        genericItem: expect.objectContaining({
          genericType: 'PROJECT',
          externalId: 'operation-1',
          visible: true,
        }),
      })
    );
    expect(state.changeVisibility).toHaveBeenCalledWith(
      expect.objectContaining({ genericItemId: 'external-1', visible: true })
    );
    expect(state.bindReference).toHaveBeenCalledWith(
      expect.objectContaining({ sourceEntityId: 'external-1' })
    );
    expect(state.completeIdempotency).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED' })
    );
  });

  it('marks unknown provider results for reconciliation', async () => {
    prepareDefaults();
    state.loadReferenceByOperation.mockResolvedValue(undefined);
    state.reserveIdempotency.mockResolvedValue({ status: 'reserved' });
    state.prepareExternalContent.mockResolvedValue({ contentId, reference: { ...reference, sourceEntityId: undefined, reconciliationStatus: 'pending' } });
    state.loadCore.mockResolvedValue(core);
    state.createGenericItem.mockRejectedValue(new Error('connection_lost'));

    const response = await dispatchSvaMainserverProjectsRequest(
      request('/api/v1/mainserver/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'operation-1' },
        body: JSON.stringify(input),
      })
    );

    expect(response?.status).toBe(500);
    expect(state.updateReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reconciliation_required' })
    );
    expect(state.completeIdempotency).not.toHaveBeenCalled();
  });

  it('read-merges hidden fields on serialized updates and soft deletes via payload marker', async () => {
    prepareDefaults();
    state.loadReferenceByContentId.mockResolvedValue(reference);
    state.getGenericItem.mockResolvedValue(genericItem);
    state.loadCore.mockResolvedValue(core);
    state.updateGenericItem.mockResolvedValue(genericItem);

    const updateResponse = await dispatchSvaMainserverProjectsRequest(
      request(`/api/v1/mainserver/projects/${contentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
    );
    expect(updateResponse?.status).toBe(200);
    expect(state.withLock).toHaveBeenCalled();
    expect(state.updateCore).toHaveBeenCalledWith(
      expect.objectContaining({ contentId, status: 'published' })
    );

    const deleteResponse = await dispatchSvaMainserverProjectsRequest(
      request(`/api/v1/mainserver/projects/${contentId}`, { method: 'DELETE' })
    );
    expect(deleteResponse?.status).toBe(200);
    expect(state.updateGenericItem).toHaveBeenLastCalledWith(
      expect.objectContaining({
        genericItem: expect.objectContaining({
          payload: expect.objectContaining({ deleted: true }),
        }),
      })
    );
    expect(state.changeVisibility).toHaveBeenLastCalledWith(
      expect.objectContaining({ visible: false })
    );
  });
});
