import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeycloakRoles } from './use-keycloak-roles';

const useIamAdminListMock = vi.fn();

vi.mock('./use-iam-admin-list', () => ({
  useIamAdminList: (...args: unknown[]) => useIamAdminListMock(...args),
}));

vi.mock('../providers/auth-provider', () => ({
  useAuth: () => ({ refreshSession: vi.fn() }),
}));

describe('useKeycloakRoles', () => {
  beforeEach(() => {
    useIamAdminListMock.mockReset();
    useIamAdminListMock.mockReturnValue({
      items: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('reports loading immediately when the lazy catalog is enabled', () => {
    const observedLoadingStates: boolean[] = [];
    const { rerender } = renderHook(
      ({ enabled }) => {
        const result = useKeycloakRoles(enabled);
        observedLoadingStates.push(result.isLoading);
        return result;
      },
      { initialProps: { enabled: false } }
    );

    rerender({ enabled: true });

    expect(observedLoadingStates).toContain(true);
  });
});
