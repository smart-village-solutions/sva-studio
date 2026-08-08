import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { hasResolvedSession: true, user: null as null | { id: string } },
  getCapabilities: vi.fn(),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => state.auth,
}));

vi.mock('../lib/iam-api', () => ({
  asIamError: (cause: unknown) => cause,
  getMainserverMutationCapabilities: state.getCapabilities,
}));

import { resetRequestSingleFlight } from '../lib/request-singleflight';
import { useMainserverMutationCapabilities } from './use-mainserver-mutation-capabilities';

const CapabilitiesProbe = () => {
  const capabilities = useMainserverMutationCapabilities();
  return (
    <div>
      <span data-testid="actions">{capabilities.enabledActions.join(',')}</span>
      <span data-testid="loading">{String(capabilities.isLoading)}</span>
      <span data-testid="error">{capabilities.error?.code ?? ''}</span>
    </div>
  );
};

describe('useMainserverMutationCapabilities', () => {
  beforeEach(() => {
    state.auth = { hasResolvedSession: true, user: null };
    state.getCapabilities.mockReset();
    resetRequestSingleFlight();
  });

  afterEach(cleanup);

  it('does not load capabilities without an authenticated session', () => {
    render(<CapabilitiesProbe />);

    expect(screen.getByTestId('actions').textContent).toBe('');
    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(state.getCapabilities).not.toHaveBeenCalled();
  });

  it('loads enabled actions for an authenticated session', async () => {
    state.auth = { hasResolvedSession: true, user: { id: 'user-1' } };
    state.getCapabilities.mockResolvedValue({
      data: { enabledActions: ['surveys.create', 'surveys.update'] },
    });

    render(<CapabilitiesProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('actions').textContent).toBe('surveys.create,surveys.update');
    });
  });

  it('fails closed when the capability endpoint is unavailable', async () => {
    state.auth = { hasResolvedSession: true, user: { id: 'user-1' } };
    state.getCapabilities.mockRejectedValue({ code: 'http_503', status: 503 });

    render(<CapabilitiesProbe />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('actions').textContent).toBe('');
      expect(screen.getByTestId('error').textContent).toBe('http_503');
    });
  });
});
