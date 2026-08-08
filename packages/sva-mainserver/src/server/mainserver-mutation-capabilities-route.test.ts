import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ withAuthenticatedUser: vi.fn() }));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

import {
  dispatchSvaMainserverMutationCapabilitiesRequest,
  MAINSERVER_MUTATION_CAPABILITIES_PATH,
} from './mainserver-mutation-capabilities-route.js';
import { getMainserverMutationCapabilityEnvironmentName } from './mainserver-mutation-capabilities.js';

const environmentName = getMainserverMutationCapabilityEnvironmentName();
const originalValue = process.env[environmentName];

describe('dispatchSvaMainserverMutationCapabilitiesRequest', () => {
  afterEach(() => {
    vi.resetAllMocks();
    if (originalValue === undefined) delete process.env[environmentName];
    else process.env[environmentName] = originalValue;
  });

  it('ignores unrelated routes before authentication', async () => {
    const response = await dispatchSvaMainserverMutationCapabilitiesRequest(
      new Request('https://studio.test/api/v1/mainserver/news')
    );

    expect(response).toBeNull();
    expect(state.withAuthenticatedUser).not.toHaveBeenCalled();
  });

  it('returns the effective capabilities for authenticated users', async () => {
    process.env[environmentName] = 'surveys.update';
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler({}));

    const response = await dispatchSvaMainserverMutationCapabilitiesRequest(
      new Request(`https://studio.test${MAINSERVER_MUTATION_CAPABILITIES_PATH}`)
    );

    expect(response?.status).toBe(200);
    const body = (await response?.json()) as { data: { enabledActions: string[] } };
    expect(body.data.enabledActions).toEqual(
      expect.arrayContaining(['surveys.create', 'surveys.update'])
    );
    expect(body.data.enabledActions).not.toContain('surveys.delete');
  });

  it('rejects unsupported methods', async () => {
    state.withAuthenticatedUser.mockImplementation((_request, handler) => handler({}));

    const response = await dispatchSvaMainserverMutationCapabilitiesRequest(
      new Request(`https://studio.test${MAINSERVER_MUTATION_CAPABILITIES_PATH}`, {
        method: 'POST',
      })
    );

    expect(response?.status).toBe(405);
  });
});
