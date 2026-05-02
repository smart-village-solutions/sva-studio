import { describe, expect, it } from 'vitest';

import {
  buildAssignInstanceModuleInput,
  buildChangeInstanceStatusInput,
  buildCreateInstanceProvisioningInput,
  buildExecuteInstanceKeycloakProvisioningInput,
  buildRevokeInstanceModuleInput,
  buildReconcileInstanceKeycloakInput,
  buildSeedInstanceIamBaselineInput,
  buildUpdateInstanceInput,
} from './mutation-input-builders.js';

describe('mutation-input-builders', () => {
  it('builds create and update inputs with actor context', () => {
    const createInput = buildCreateInstanceProvisioningInput(
      {
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
        featureFlags: { beta: true },
      },
      { idempotencyKey: 'idem-1', actorId: 'user-1', requestId: 'req-1' }
    );

    expect(createInput).toMatchObject({
      idempotencyKey: 'idem-1',
      instanceId: 'demo',
      actorId: 'user-1',
      requestId: 'req-1',
      featureFlags: { beta: true },
    });

    const updateInput = buildUpdateInstanceInput(
      'demo',
      {
        displayName: 'Demo 2',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      },
      { actorId: 'user-1', requestId: 'req-2' }
    );

    expect(updateInput).toMatchObject({
      instanceId: 'demo',
      displayName: 'Demo 2',
      actorId: 'user-1',
      requestId: 'req-2',
    });
  });

  it('builds status and keycloak mutation inputs', () => {
    expect(
      buildChangeInstanceStatusInput('demo', 'active', {
        idempotencyKey: 'idem-2',
        actorId: 'user-1',
        requestId: 'req-3',
      })
    ).toEqual({
      idempotencyKey: 'idem-2',
      instanceId: 'demo',
      nextStatus: 'active',
      actorId: 'user-1',
      requestId: 'req-3',
    });

    expect(
      buildReconcileInstanceKeycloakInput(
        'demo',
        { rotateClientSecret: true, tenantAdminTemporaryPassword: 'tmp-password' },
        { idempotencyKey: 'idem-4', actorId: 'user-1', requestId: 'req-4' }
      )
    ).toEqual({
      idempotencyKey: 'idem-4',
      instanceId: 'demo',
      actorId: 'user-1',
      requestId: 'req-4',
      rotateClientSecret: true,
      tenantAdminTemporaryPassword: 'tmp-password',
    });

    expect(
      buildExecuteInstanceKeycloakProvisioningInput(
        'demo',
        { intent: 'provision', tenantAdminTemporaryPassword: 'tmp-password' },
        { idempotencyKey: 'idem-5', actorId: 'user-1', requestId: 'req-5' }
      )
    ).toEqual({
      idempotencyKey: 'idem-5',
      instanceId: 'demo',
      actorId: 'user-1',
      requestId: 'req-5',
      intent: 'provision',
      tenantAdminTemporaryPassword: 'tmp-password',
    });

    expect(
      buildAssignInstanceModuleInput(
        'demo',
        { moduleId: 'news' },
        { idempotencyKey: 'idem-6', actorId: 'user-1', requestId: 'req-6' }
      )
    ).toEqual({
      idempotencyKey: 'idem-6',
      instanceId: 'demo',
      moduleId: 'news',
      actorId: 'user-1',
      requestId: 'req-6',
    });

    expect(
      buildRevokeInstanceModuleInput(
        'demo',
        { moduleId: 'news', confirmation: 'REVOKE' },
        { idempotencyKey: 'idem-7', actorId: 'user-1', requestId: 'req-7' }
      )
    ).toEqual({
      idempotencyKey: 'idem-7',
      instanceId: 'demo',
      moduleId: 'news',
      confirmation: 'REVOKE',
      actorId: 'user-1',
      requestId: 'req-7',
    });

    expect(buildSeedInstanceIamBaselineInput('demo', { idempotencyKey: 'idem-8', actorId: 'user-1', requestId: 'req-8' }))
      .toEqual({
        idempotencyKey: 'idem-8',
        instanceId: 'demo',
        actorId: 'user-1',
        requestId: 'req-8',
      });
  });
});
