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
  instancesAuditRun: null,
  isLoading: false,
  detailLoading: false,
  statusLoading: false,
  auditLoading: false,
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
  refreshInstancesAudit: vi.fn().mockResolvedValue(true),
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
    const refreshInstancesAudit = vi.fn();
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        setSearch,
        setStatus,
        activateInstance,
        suspendInstance,
        archiveInstance,
        refreshInstancesAudit,
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Gesamt-Audit starten' })[0]!);

    expect(setSearch).toHaveBeenCalledWith('alpha');
    expect(setStatus).toHaveBeenCalledWith('active');
    expect(activateInstance).toHaveBeenCalledWith('demo');
    expect(suspendInstance).toHaveBeenCalledWith('demo');
    expect(archiveInstance).toHaveBeenCalledWith('demo');
    expect(refreshInstancesAudit).toHaveBeenCalledWith();
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

  it('renders audit trigger errors from mutationError', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: { status: 403, code: 'forbidden', message: 'forbidden' },
      })
    );

    render(<InstancesPage />);

    expect(screen.getByRole('alert').textContent).toContain('Keine Berechtigung für die Instanzverwaltung.');
  });

  it('renders the overall audit result when available', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        instancesAuditRun: {
          generatedAt: '2026-06-10T10:00:00.000Z',
          overallStatus: 'warn',
          summary: {
            totalInstances: 1,
            passedInstances: 0,
            warnedInstances: 1,
            failedInstances: 0,
            skippedInstances: 0,
          },
          checks: [],
          instances: [
            {
              instanceId: 'demo',
              displayName: 'Demo',
              primaryHostname: 'demo.studio.example.org',
              status: 'active',
              overallStatus: 'warn',
              checks: [
                {
                  checkId: 'instance.url.reachable',
                  title: 'Instanz erreichbar',
                  scope: 'instance',
                  status: 'warn',
                  expected: 'HTTP 200',
                  actual: 'HTTP 302',
                  evidenceSource: 'httpProbe',
                  message: 'Probe folgt Redirect.',
                },
              ],
            },
          ],
        },
      })
    );

    render(<InstancesPage />);

    expect(screen.getByText('Audit')).toBeTruthy();
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0);
    expect(screen.getByText('Instanz erreichbar')).toBeTruthy();
    expect(screen.getByText('HTTP 302')).toBeTruthy();
  });
});
