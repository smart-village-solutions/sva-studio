import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const evaluateAuthorizeDecision = vi.hoisted(() => vi.fn());

vi.mock('@sva/iam-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/iam-core')>()),
  evaluateAuthorizeDecision,
}));

import { pluginServerHost } from './plugin-server-host.js';
import {
  clearAuthorizedPluginRequest,
  setAuthorizedPluginRequest,
} from './plugin-server-handlers/authorized-request.js';

describe('pluginServerHost.authorizePluginAction', () => {
  beforeEach(() => vi.clearAllMocks());

  const input = {
    request: new Request('https://studio.test/api/v1/waste-management/tours'),
    handlerId: 'waste-management.listTours.get',
    instanceId: 'tenant-a',
    keycloakSubject: 'subject-a',
    action: 'waste-management.tours.manage',
    resourceType: 'waste-management',
    requestId: 'request-a',
  };
  afterEach(() => clearAuthorizedPluginRequest(input.request));

  it('reuses the dispatcher decision without another permission lookup or evaluation', async () => {
    const permissions = [{ action: input.action, resourceType: input.resourceType }];
    setAuthorizedPluginRequest(input.request, {
      pluginId: input.resourceType,
      handlerId: input.handlerId,
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      permissions,
      decisions: new Map([[input.action, { allowed: true, reason: 'allowed' }]]),
    });

    await expect(pluginServerHost.authorizePluginAction(input)).resolves.toEqual({
      ok: true,
      allowed: true,
      reason: 'allowed',
    });
    expect(evaluateAuthorizeDecision).not.toHaveBeenCalled();
  });

  it('evaluates a body-dependent extra action from the already resolved grants', async () => {
    const permissions = [{ action: input.action, resourceType: input.resourceType }];
    setAuthorizedPluginRequest(input.request, {
      pluginId: input.resourceType,
      handlerId: input.handlerId,
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      permissions,
      decisions: new Map([[input.action, { allowed: true, reason: 'allowed' }]]),
    });
    evaluateAuthorizeDecision.mockReturnValueOnce({ allowed: false, reason: 'permission_missing' });

    await expect(
      pluginServerHost.authorizePluginAction({
        ...input,
        action: 'waste-management.scheduling.manage',
      })
    ).resolves.toEqual({ ok: true, allowed: false, reason: 'permission_missing' });
    expect(evaluateAuthorizeDecision).toHaveBeenCalledWith(
      {
        instanceId: input.instanceId,
        action: 'waste-management.scheduling.manage',
        resource: { type: input.resourceType },
        context: { requestId: input.requestId },
      },
      permissions
    );
  });

  it('rejects missing or mismatched dispatcher evidence', async () => {
    await expect(pluginServerHost.authorizePluginAction(input)).resolves.toEqual({
      ok: true,
      allowed: false,
      reason: 'unverified_request',
    });
    setAuthorizedPluginRequest(input.request, {
      pluginId: input.resourceType,
      handlerId: input.handlerId,
      instanceId: input.instanceId,
      keycloakSubject: input.keycloakSubject,
      permissions: [],
      decisions: new Map(),
    });
    await expect(
      pluginServerHost.authorizePluginAction({ ...input, instanceId: 'other' })
    ).resolves.toEqual({
      ok: true,
      allowed: false,
      reason: 'unverified_request',
    });
    await expect(
      pluginServerHost.authorizePluginAction({ ...input, handlerId: 'other-handler' })
    ).resolves.toEqual({ ok: true, allowed: false, reason: 'unverified_request' });
    expect(evaluateAuthorizeDecision).not.toHaveBeenCalled();
  });
});
