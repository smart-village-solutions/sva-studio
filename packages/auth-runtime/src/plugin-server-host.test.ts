import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveEffectivePermissions = vi.hoisted(() => vi.fn());
const evaluateAuthorizeDecision = vi.hoisted(() => vi.fn());

vi.mock('./iam-authorization/permission-store.js', () => ({ resolveEffectivePermissions }));
vi.mock('@sva/iam-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/iam-core')>()),
  evaluateAuthorizeDecision,
}));

import { pluginServerHost } from './plugin-server-host.js';

describe('pluginServerHost.authorizePluginAction', () => {
  beforeEach(() => vi.clearAllMocks());

  const input = {
    instanceId: 'tenant-a',
    keycloakSubject: 'subject-a',
    action: 'waste-management.tours.manage',
    resourceType: 'waste-management',
    requestId: 'request-a',
  };

  it('evaluates the resolved permissions for the supplied action and resource', async () => {
    const permissions = [{ action: input.action, resourceType: input.resourceType }];
    resolveEffectivePermissions.mockResolvedValueOnce({ ok: true, permissions });
    evaluateAuthorizeDecision.mockReturnValueOnce({ allowed: false, reason: 'permission_missing' });

    await expect(pluginServerHost.authorizePluginAction(input)).resolves.toEqual({
      ok: true,
      allowed: false,
      reason: 'permission_missing',
    });
    expect(resolveEffectivePermissions).toHaveBeenCalledWith({
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
    });
    expect(evaluateAuthorizeDecision).toHaveBeenCalledWith(
      {
        instanceId: input.instanceId,
        action: input.action,
        resource: { type: input.resourceType },
        context: { requestId: input.requestId },
      },
      permissions
    );
  });

  it('fails closed when permission resolution is unavailable', async () => {
    resolveEffectivePermissions.mockResolvedValueOnce({ ok: false });

    await expect(pluginServerHost.authorizePluginAction(input)).resolves.toEqual({ ok: false });
    expect(evaluateAuthorizeDecision).not.toHaveBeenCalled();
  });
});
