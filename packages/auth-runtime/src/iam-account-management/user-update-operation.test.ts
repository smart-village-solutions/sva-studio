import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createUserUpdatePersistence: vi.fn(() => ({
    persistUpdatedUserDetail: vi.fn(),
  })),
  shouldUpdateUserIdentityAttributes: vi.fn(),
  shouldUpdateUserIdentityPayload: vi.fn(),
  getSvaMainserverCredentialAttributeNames: vi.fn(() => ['mainserverUserApplicationId']),
  resolveMainserverCredentialState: vi.fn((attributes) => ({
    mainserverUserApplicationId: attributes.mainserverUserApplicationId?.[0],
    mainserverUserApplicationSecretSet: Boolean(attributes.mainserverUserApplicationSecret?.[0]),
  })),
  buildIdentityAttributesForUserUpdate: vi.fn(() => ({
    mainserverUserApplicationId: ['app-2'],
    mainserverUserApplicationSecret: ['secret'],
  })),
  trackKeycloakCall: vi.fn(async (_operation, work) => work()),
}));

vi.mock('@sva/iam-admin', () => ({
  createUserUpdatePersistence: state.createUserUpdatePersistence,
  shouldUpdateUserIdentityAttributes: state.shouldUpdateUserIdentityAttributes,
  shouldUpdateUserIdentityPayload: state.shouldUpdateUserIdentityPayload,
}));

vi.mock('../mainserver-credentials.js', () => ({
  getSvaMainserverCredentialAttributeNames: state.getSvaMainserverCredentialAttributeNames,
  resolveMainserverCredentialState: state.resolveMainserverCredentialState,
}));

vi.mock('./shared-assignment.js', () => ({
  assignGroups: vi.fn(),
  assignRoles: vi.fn(),
}));

vi.mock('./shared-activity.js', () => ({
  emitActivityLog: vi.fn(),
  notifyPermissionInvalidation: vi.fn(),
}));

vi.mock('./shared-observability.js', () => ({
  trackKeycloakCall: state.trackKeycloakCall,
}));

vi.mock('./shared-runtime.js', () => ({
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('./user-detail-query.js', () => ({
  resolveUserDetail: vi.fn(),
}));

vi.mock('../session-revocation.js', () => ({
  revokeUserSessions: vi.fn(),
  clearUserSessionLoginBlock: vi.fn(),
}));

vi.mock('./user-update-identity.js', () => ({
  buildIdentityAttributesForUserUpdate: state.buildIdentityAttributesForUserUpdate,
}));

import { resolveUpdatedIdentityState } from './user-update-operation.js';

describe('user-update-operation', () => {
  const plan = {
    existing: {
      keycloakSubject: 'kc-user-1',
    },
  } as const;

  const payload = {
    email: 'alice@example.com',
  } as const;

  const identityProvider = {
    provider: {
      getUserAttributes: vi.fn(async () => ({
        mainserverUserApplicationId: ['app-1'],
        mainserverUserApplicationSecret: ['secret'],
      })),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    identityProvider.provider.getUserAttributes.mockClear();
  });

  it('returns the idle state when no identity-related updates are required', async () => {
    state.shouldUpdateUserIdentityAttributes.mockReturnValue(false);
    state.shouldUpdateUserIdentityPayload.mockReturnValue(false);

    await expect(resolveUpdatedIdentityState({ plan, payload })).resolves.toEqual({
      existingIdentityAttributes: undefined,
      nextIdentityAttributes: undefined,
      nextMainserverCredentialState: undefined,
      shouldUpdateIdentity: false,
    });
  });

  it('requires an identity provider when identity attributes must be updated', async () => {
    state.shouldUpdateUserIdentityAttributes.mockReturnValue(true);
    state.shouldUpdateUserIdentityPayload.mockReturnValue(true);

    await expect(resolveUpdatedIdentityState({ plan, payload })).rejects.toThrow(
      'identity_provider_resolution_unavailable'
    );
  });

  it('loads existing attributes, builds the next attributes and resolves mainserver credential state', async () => {
    state.shouldUpdateUserIdentityAttributes.mockReturnValue(true);
    state.shouldUpdateUserIdentityPayload.mockReturnValue(true);

    const result = await resolveUpdatedIdentityState({
      plan,
      payload,
      identityProvider,
    });

    expect(identityProvider.provider.getUserAttributes).toHaveBeenCalledWith('kc-user-1');
    expect(state.buildIdentityAttributesForUserUpdate).toHaveBeenCalledWith({
      existingAttributes: {
        mainserverUserApplicationId: ['app-1'],
        mainserverUserApplicationSecret: ['secret'],
      },
      payload,
    });
    expect(result).toEqual({
      existingIdentityAttributes: {
        mainserverUserApplicationId: ['app-1'],
        mainserverUserApplicationSecret: ['secret'],
      },
      nextIdentityAttributes: {
        mainserverUserApplicationId: ['app-2'],
        mainserverUserApplicationSecret: ['secret'],
      },
      nextMainserverCredentialState: {
        mainserverUserApplicationId: 'app-2',
        mainserverUserApplicationSecretSet: true,
      },
      shouldUpdateIdentity: true,
    });
  });

  it('reads only the mainserver credential attributes for response shaping when no attribute mutation is needed', async () => {
    state.shouldUpdateUserIdentityAttributes.mockReturnValue(false);
    state.shouldUpdateUserIdentityPayload.mockReturnValue(true);

    const result = await resolveUpdatedIdentityState({
      plan,
      payload,
      identityProvider,
    });

    expect(identityProvider.provider.getUserAttributes).toHaveBeenCalledWith('kc-user-1', [
      'mainserverUserApplicationId',
    ]);
    expect(result).toEqual({
      existingIdentityAttributes: undefined,
      nextIdentityAttributes: undefined,
      nextMainserverCredentialState: {
        mainserverUserApplicationId: 'app-1',
        mainserverUserApplicationSecretSet: true,
      },
      shouldUpdateIdentity: true,
    });
  });
});
