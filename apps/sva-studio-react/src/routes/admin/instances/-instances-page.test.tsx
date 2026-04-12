import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstancesPage } from './-instances-page';

const useInstancesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: Record<string, string> }) => (
    <a href={params?.instanceId ? `${to.replace('$instanceId', params.instanceId)}` : to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

const createInstancesApiState = (overrides: Record<string, unknown> = {}) => ({
  instances: [
    {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
    },
  ],
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
  createInstance: vi.fn().mockResolvedValue(true),
  updateInstance: vi.fn().mockResolvedValue(true),
  refreshKeycloakStatus: vi.fn().mockResolvedValue(true),
  reconcileKeycloak: vi.fn().mockResolvedValue(true),
  activateInstance: vi.fn().mockResolvedValue(true),
  suspendInstance: vi.fn().mockResolvedValue(true),
  archiveInstance: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('InstancesPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
  });

  it('renders the overview table and row actions', () => {
    const setSearch = vi.fn();
    const setStatus = vi.fn();
    const activateInstance = vi.fn();
    const suspendInstance = vi.fn();
    const archiveInstance = vi.fn();
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        setSearch,
        setStatus,
        activateInstance,
        suspendInstance,
        archiveInstance,
      })
    );

    render(<InstancesPage />);

    expect(screen.getByRole('heading', { name: 'Instanzverwaltung' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Instanzliste' })).toBeTruthy();
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
    const hostnameLink = screen.getAllByRole('link', { name: 'demo.studio.example.org' })[0];
    expect(hostnameLink.getAttribute('href')).toBe('https://demo.studio.example.org');
    expect(hostnameLink.getAttribute('target')).toBe('_blank');
    expect(hostnameLink.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Instanz anlegen' }).getAttribute('href')).toBe('/admin/instances/new');
    expect(screen.getAllByRole('link', { name: 'Bearbeiten' })[0]?.getAttribute('href')).toBe('/admin/instances/demo');

    fireEvent.change(screen.getByPlaceholderText('Nach Instanz-ID oder Anzeigename suchen'), {
      target: { value: 'alpha' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'active' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Aktivieren' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Suspendieren' })[0]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Archivieren' })[0]!);

    expect(setSearch).toHaveBeenCalledWith('alpha');
    expect(setStatus).toHaveBeenCalledWith('active');
    expect(activateInstance).toHaveBeenCalledWith('demo');
    expect(suspendInstance).toHaveBeenCalledWith('demo');
    expect(archiveInstance).toHaveBeenCalledWith('demo');
  });

  it('renders page-level errors and empty state', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        instances: [],
        error: { status: 403, code: 'forbidden', message: 'forbidden' },
      })
    );

    render(<InstancesPage />);

    expect(screen.getByText('Es sind aktuell keine Instanzen vorhanden.')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Keine Berechtigung für die Instanzverwaltung.');
  });
});
