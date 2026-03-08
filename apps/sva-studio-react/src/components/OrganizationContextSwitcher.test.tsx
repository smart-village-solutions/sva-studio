import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OrganizationContextSwitcher } from './OrganizationContextSwitcher';

const useOrganizationContextMock = vi.fn();

vi.mock('../hooks/use-organization-context', () => ({
  useOrganizationContext: () => useOrganizationContextMock(),
}));

describe('OrganizationContextSwitcher', () => {
  afterEach(() => {
    cleanup();
    useOrganizationContextMock.mockReset();
  });

  it('renders nothing when only one active organization is available', () => {
    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization: vi.fn(),
    });

    render(<OrganizationContextSwitcher />);

    expect(screen.queryByLabelText('Aktive Organisation')).toBeNull();
  });

  it('switches the active organization when a different option is selected', () => {
    const switchOrganization = vi.fn().mockResolvedValue(true);

    useOrganizationContextMock.mockReturnValue({
      context: {
        activeOrganizationId: 'org-1',
        organizations: [
          {
            organizationId: 'org-1',
            organizationKey: 'alpha',
            displayName: 'Alpha',
            organizationType: 'county',
            isActive: true,
            isDefaultContext: true,
          },
          {
            organizationId: 'org-2',
            organizationKey: 'beta',
            displayName: 'Beta',
            organizationType: 'municipality',
            isActive: true,
            isDefaultContext: false,
          },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      refetch: vi.fn(),
      switchOrganization,
    });

    render(<OrganizationContextSwitcher />);

    fireEvent.change(screen.getByLabelText('Aktive Organisation'), {
      target: { value: 'org-2' },
    });

    expect(switchOrganization).toHaveBeenCalledWith('org-2');
  });
});
