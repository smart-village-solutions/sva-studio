import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstanceCreatePage } from './-instance-create-page';

const useInstancesMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

const createInstancesApiState = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
  selectedInstance: null,
  isLoading: false,
  detailLoading: false,
  statusLoading: false,
  error: null,
  mutationError: null,
  filters: {
    search: '',
    status: 'all',
  },
  setSearch: vi.fn(),
  setStatus: vi.fn(),
  refetch: vi.fn(),
  loadInstance: vi.fn().mockResolvedValue(true),
  clearSelectedInstance: vi.fn(),
  clearMutationError: vi.fn(),
  createInstance: vi.fn().mockResolvedValue({ instanceId: 'demo' }),
  updateInstance: vi.fn().mockResolvedValue(true),
  refreshKeycloakStatus: vi.fn().mockResolvedValue(true),
  reconcileKeycloak: vi.fn().mockResolvedValue(true),
  activateInstance: vi.fn().mockResolvedValue(true),
  suspendInstance: vi.fn().mockResolvedValue(true),
  archiveInstance: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('InstanceCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
    navigateMock.mockReset();
  });

  it('prefills the parent domain and navigates to the new detail page after creation', async () => {
    const createInstance = vi.fn().mockResolvedValue({ instanceId: 'demo' });
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance }));
    window.history.replaceState({}, '', '/admin/instances/new');

    render(<InstanceCreatePage />);

    const parentDomainInput = screen.getByLabelText('Parent-Domain') as HTMLInputElement;
    expect(parentDomainInput.value).toBe('localhost');
    expect(parentDomainInput.placeholder).toBe('localhost');

    fireEvent.change(screen.getByLabelText('Instanz-ID'), { target: { value: ' demo ' } });
    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: ' Demo ' } });
    fireEvent.change(parentDomainInput, { target: { value: ' studio.example.org ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(createInstance).toHaveBeenCalledWith({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
    });

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/instances/$instanceId',
      params: { instanceId: 'demo' },
    });
  });

  it('renders mutation errors', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: { status: 503, code: 'encryption_not_configured', message: 'kaputt' },
      })
    );

    render(<InstanceCreatePage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Die notwendige Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.'
    );
  });
});
