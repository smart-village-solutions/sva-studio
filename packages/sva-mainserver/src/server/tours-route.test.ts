import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorize: vi.fn(),
  moduleAccess: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  validateCsrf: vi.fn(),
  resolveMutationActor: vi.fn(),
  create: vi.fn(),
  editorRead: vi.fn(),
  update: vi.fn(),
  resolveResourceActor: vi.fn(),
  resolveResourceAccess: vi.fn(),
  capability: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeContentPrimitiveForUser: state.authorize,
  readConfiguredPluginTenantAccess: state.moduleAccess,
  validateCsrf: state.validateCsrf,
  withAuthenticatedUser: (_request: Request, respond: (ctx: unknown) => Promise<Response>) =>
    respond({ user: { id: 'user', instanceId: 'tenant' } }),
}));
vi.mock('./service-internals/service-context.js', () => ({ createServiceContext: () => ({}) }));
vi.mock('./tour-reads.js', () => ({ createTourReads: () => state }));
vi.mock('./mutation-principal.js', () => ({
  resolveMainserverMutationActor: state.resolveMutationActor,
  resolveMainserverResourceActor: state.resolveResourceActor,
}));
vi.mock('./tour-create.js', () => ({ handleTourCreate: state.create }));
vi.mock('./tour-editor.js', () => ({
  createTourEditor: () => ({ read: state.editorRead }),
  handleTourUpdate: state.update,
  hasExactTourEditorAccess: state.resolveResourceAccess,
}));
vi.mock('./mainserver-mutation-capabilities.js', () => ({
  isMainserverMutationCapabilityEnabled: state.capability,
}));

import { dispatchSvaMainserverToursRequest } from './tours-route.js';

const request = (path = '', method = 'GET') =>
  new Request(`https://studio.test/api/v1/mainserver/tours${path}`, { method });
const actor = { instanceId: 'tenant', keycloakSubject: 'user' };

beforeEach(() => {
  vi.resetAllMocks();
  state.authorize.mockResolvedValue({ ok: true, actor });
  state.moduleAccess.mockResolvedValue({ allowed: true });
  state.capability.mockReturnValue(false);
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
    expect((await dispatchSvaMainserverToursRequest(request('/1', 'PATCH')))?.status).toBe(503);
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

describe('Studio tour editor routes', () => {
  it('fails closed for editor read and update until the capability is enabled', async () => {
    expect((await dispatchSvaMainserverToursRequest(request('/1/editor')))?.status).toBe(503);
    expect((await dispatchSvaMainserverToursRequest(request('/1', 'PATCH')))?.status).toBe(503);
    expect(state.capability).toHaveBeenCalledWith('tours.update');
    expect(state.editorRead).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });

  it('returns editor data and a context binding after exact authorization in the active organization', async () => {
    state.capability.mockReturnValue(true);
    state.authorize.mockResolvedValue({ ok: true, actor: { ...actor, organizationId: 'org' } });
    const resourceActor = {
      ...actor,
      activeOrganizationId: 'org',
      actingPrincipalType: 'organization',
    };
    const data = { id: '1', revision: 'revision' };
    state.resolveResourceActor.mockResolvedValue(resourceActor);
    state.editorRead.mockResolvedValue(data);
    state.resolveResourceAccess.mockResolvedValue(true);

    const nativeRequest = request('/1/editor');
    nativeRequest.headers.set('x-sva-acting-principal-type', 'user');
    // Nitro's request inherits from Request without Undici's private state.
    const input: Request = Object.create(Request.prototype, {
      url: { value: nativeRequest.url },
      method: { value: nativeRequest.method },
      headers: { value: nativeRequest.headers },
    });
    const response = await dispatchSvaMainserverToursRequest(input);

    expect(response?.status).toBe(200);
    expect(response?.headers.get('X-SVA-Context-Binding')).toMatch(/^v1\./);
    await expect(response?.json()).resolves.toEqual({ data });
    expect(
      state.resolveResourceActor.mock.calls[0]?.[0].request.headers.get(
        'x-sva-acting-principal-type'
      )
    ).toBe('organization');
    expect(state.resolveResourceAccess).toHaveBeenCalledWith(resourceActor, data);
    state.resolveResourceAccess.mockResolvedValueOnce(false);
    expect((await dispatchSvaMainserverToursRequest(input))?.status).toBe(403);
  });

  it('checks CSRF and the resolved principal against the active context before update', async () => {
    state.capability.mockReturnValue(true);
    const patch = request('/1', 'PATCH');
    state.validateCsrf.mockReturnValueOnce('csrf');
    expect((await dispatchSvaMainserverToursRequest(patch))?.status).toBe(403);
    expect(state.resolveMutationActor).not.toHaveBeenCalled();

    const organizationActor = {
      ...actor,
      activeOrganizationId: 'org',
      actingPrincipalType: 'organization',
    };
    state.resolveMutationActor.mockResolvedValueOnce({
      ...organizationActor,
      actingPrincipalType: 'user',
    });
    expect((await dispatchSvaMainserverToursRequest(patch))?.status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();

    state.resolveMutationActor.mockResolvedValueOnce(organizationActor);
    state.update.mockResolvedValueOnce(Response.json({ data: { id: '1' } }));
    expect((await dispatchSvaMainserverToursRequest(patch))?.status).toBe(200);
    expect(state.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tours.update',
        resource: { contentType: 'tours.tour', contentId: '1' },
      })
    );
    expect(state.update).toHaveBeenCalledWith(
      patch, organizationActor, '1', expect.anything(), expect.objectContaining({ user: expect.anything() })
    );
  });
});
