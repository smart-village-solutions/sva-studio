import { beforeEach, expect, it, vi } from 'vitest';
import type { RegistryRequestContext } from './auth-context';
const s = vi.hoisted(() => ({
  access: vi.fn(),
  csrf: vi.fn(),
  fresh: vi.fn(),
  read: vi.fn(),
  mutate: vi.fn(),
  readServer: vi.fn(),
  saveServer: vi.fn(),
}));
vi.mock('./http.js', () => ({ ensurePlatformAccess: s.access, requireFreshReauth: s.fresh }));
vi.mock('../iam-account-management/csrf.js', () => ({ validateCsrf: s.csrf }));
vi.mock('./mail-template-sync.js', () => ({
  readMailTemplate: s.read,
  readServerEmailVerificationTemplate: s.readServer,
  saveServerEmailVerificationTemplate: s.saveServer,
  mutateMailTemplate: s.mutate,
  MailTemplateConflict: class extends Error {},
}));
import {
  emailVerificationTemplateInternal as handle,
  serverEmailVerificationTemplateInternal as handleServer,
} from './email-verification-template';
const ctx = { authKind: 'session', user: { id: 'admin' } } as RegistryRequestContext;
const request = (method = 'GET', body: unknown = {}) =>
  new Request(
    'https://studio.example/api/v1/iam/instances/hvl/keycloak/mail-templates/verification',
    { method, ...(method === 'PATCH' ? { body: JSON.stringify(body) } : {}) }
  );
beforeEach(() => {
  vi.resetAllMocks();
  s.read.mockResolvedValue({ status: 'unreviewed' });
  s.mutate.mockResolvedValue({ status: 'failed' });
});
it('reads the registry-bound verification source', async () => {
  expect((await handle(request(), ctx)).status).toBe(200);
  expect(s.read).toHaveBeenCalledWith('hvl', 'verification');
});
it.each(['access', 'csrf', 'fresh'] as const)('enforces %s before writes', async (guard) => {
  s[guard].mockReturnValue(new Response(null, { status: 403 }));
  expect(
    (
      await handle(
        request('PATCH', { operation: 'save', expectedRevision: 0, template: null }),
        ctx
      )
    ).status
  ).toBe(403);
  expect(s.mutate).not.toHaveBeenCalled();
});
it('rejects arbitrary realm and wrong template kind', async () => {
  expect(
    (
      await handle(
        request('PATCH', {
          operation: 'save',
          expectedRevision: 0,
          template: null,
          realm: 'foreign',
        }),
        ctx
      )
    ).status
  ).toBe(400);
  expect(s.mutate).not.toHaveBeenCalled();
});
it('returns saved but unsynchronized source as data', async () => {
  const response = await handle(
    request('PATCH', { operation: 'save', expectedRevision: 0, template: null }),
    ctx
  );
  expect(response.status).toBe(200);
  expect((await response.json()).data.status).toBe('failed');
});

const serverRequest = (method = 'GET', body: unknown = {}) =>
  new Request('https://studio.example/api/v1/iam/templates/email-verification', {
    method,
    ...(method === 'PATCH' ? { body: JSON.stringify(body) } : {}),
  });
it('reads and saves the general confirmation template separately', async () => {
  s.readServer.mockResolvedValue({
    revision: 1,
    template: { subject: 'Standard', body: '{{verificationLink}}' },
    source: 'server',
  });
  expect((await handleServer(serverRequest(), ctx)).status).toBe(200);
  s.saveServer.mockResolvedValue({ revision: 2, unsynchronizedInstances: ['hvl'] });
  const response = await handleServer(
    serverRequest('PATCH', { expectedRevision: 1, template: null }),
    ctx
  );
  expect(response.status).toBe(200);
  expect((await response.json()).data.unsynchronizedInstances).toEqual(['hvl']);
  expect(s.saveServer).toHaveBeenCalledWith({
    expectedRevision: 1,
    template: null,
    actorId: 'admin',
  });
});
it.each(['access', 'csrf', 'fresh'] as const)(
  'guards the general template with %s',
  async (guard) => {
    s[guard].mockReturnValue(new Response(null, { status: 403 }));
    expect(
      (await handleServer(serverRequest('PATCH', { expectedRevision: 0, template: null }), ctx))
        .status
    ).toBe(403);
    expect(s.saveServer).not.toHaveBeenCalled();
  }
);
it('rejects arbitrary instance scope and stale general revisions', async () => {
  expect(
    (
      await handleServer(
        serverRequest('PATCH', { expectedRevision: 0, template: null, instanceId: 'foreign' }),
        ctx
      )
    ).status
  ).toBe(400);
  s.saveServer.mockRejectedValue(new Error('mail_template_revision_conflict'));
  expect(
    (await handleServer(serverRequest('PATCH', { expectedRevision: 0, template: null }), ctx))
      .status
  ).toBe(409);
});
