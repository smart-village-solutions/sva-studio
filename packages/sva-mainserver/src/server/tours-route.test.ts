import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  moduleAccess: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  validateCsrf: vi.fn(),
  resolveMutationActor: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorize,
  readConfiguredPluginTenantAccess: state.moduleAccess,
  validateCsrf: state.validateCsrf,
  withAuthenticatedUser: (_request: Request, respond: (ctx: unknown) => Promise<Response>) =>
    respond({}),
}));
vi.mock('./service-internals/service-context.js', () => ({ createServiceContext: () => ({}) }));
vi.mock('./tour-reads.js', () => ({ createTourReads: () => state }));
vi.mock('./mutation-principal.js', () => ({
  resolveMainserverMutationActor: state.resolveMutationActor,
}));
vi.mock('./tour-create.js', () => ({ handleTourCreate: state.create }));

import { dispatchSvaMainserverToursRequest } from './tours-route.js';

const request = (path = '', method = 'GET') =>
  new Request(`https://studio.test/api/v1/mainserver/tours${path}`, { method });
const actor = { instanceId: 'tenant', keycloakSubject: 'user' };

beforeEach(() => {
  vi.resetAllMocks();
  state.authorize.mockResolvedValue({ ok: true, actor });
  state.moduleAccess.mockResolvedValue({ allowed: true });
});

describe('Studio tour read routes', () => {
  it('checks permissions and effective module state before provider calls', async () => {
    state.authorize.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Forbidden',
    });
    expect((await dispatchSvaMainserverToursRequest(request('/1')))?.status).toBe(403);
    expect(state.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tours.read', resource: { contentType: 'tours.tour' } })
    );
    state.moduleAccess.mockResolvedValueOnce({ allowed: false });
    expect((await dispatchSvaMainserverToursRequest(request()))?.status).toBe(403);
    expect(state.moduleAccess).toHaveBeenCalledWith(actor.instanceId, 'tours');
    expect(state.detail).not.toHaveBeenCalled();
    expect(state.list).not.toHaveBeenCalled();
  });

  it('uses the same authorized context for the list and detail without honoring a caller-supplied principal', async () => {
    state.authorize.mockResolvedValue({ ok: true, actor: { ...actor, organizationId: 'org' } });
    state.list.mockResolvedValue({ data: [] });
    state.detail.mockResolvedValue(null);
    const listRequest = request('?page=2');
    listRequest.headers.set('x-sva-acting-principal-type', 'user');
    expect((await dispatchSvaMainserverToursRequest(listRequest))?.status).toBe(200);
    expect((await dispatchSvaMainserverToursRequest(request('/1')))?.status).toBe(404);
    const connection = {
      ...actor,
      activeOrganizationId: 'org',
      actingPrincipalType: 'organization',
    };
    expect(state.list).toHaveBeenCalledWith(connection, { page: 2, pageSize: 25 });
    expect(state.detail).toHaveBeenCalledWith(connection, '1');
  });

  it('uses personal credentials without an organization and rejects edits', async () => {
    state.detail.mockResolvedValue({ id: '1' });
    expect((await dispatchSvaMainserverToursRequest(request('/1')))?.status).toBe(200);
    expect(state.detail).toHaveBeenCalledWith({ ...actor, actingPrincipalType: 'user' }, '1');
    expect((await dispatchSvaMainserverToursRequest(request('/1', 'PATCH')))?.status).toBe(405);
    expect(state.list).not.toHaveBeenCalled();
  });

  it('applies create authorization, module activation and CSRF before resolving a write principal', async () => {
    state.validateCsrf.mockReturnValueOnce('csrf');
    const createRequest = request('', 'POST');
    expect((await dispatchSvaMainserverToursRequest(createRequest))?.status).toBe(403);
    expect(state.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tours.create' })
    );
    expect(state.resolveMutationActor).not.toHaveBeenCalled();
    state.resolveMutationActor.mockResolvedValue(actor);
    state.create.mockResolvedValue(new Response(null, { status: 201 }));
    expect((await dispatchSvaMainserverToursRequest(createRequest))?.status).toBe(201);
    expect(state.create).toHaveBeenCalledOnce();
  });
});
