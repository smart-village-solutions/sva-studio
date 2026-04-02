import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstancesPage } from './-instances-page';

const useInstancesMock = vi.fn();

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

  it('renders the table, filters and mutation actions', () => {
    const setSearch = vi.fn();
    const setStatus = vi.fn();
    const loadInstance = vi.fn();
    const activateInstance = vi.fn();
    const suspendInstance = vi.fn();
    const archiveInstance = vi.fn();
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        setSearch,
        setStatus,
        loadInstance,
        activateInstance,
        suspendInstance,
        archiveInstance,
      })
    );

    render(<InstancesPage />);

    expect(screen.getByRole('heading', { name: 'Instanzverwaltung' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Instanzliste' })).toBeTruthy();
    expect(screen.getByText('Demo')).toBeTruthy();
    expect(screen.getByText('demo.studio.example.org')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Nach Instanz-ID oder Anzeigename suchen'), {
      target: { value: 'alpha' },
    });
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'active' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aktivieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Suspendieren' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archivieren' }));

    expect(setSearch).toHaveBeenCalledWith('alpha');
    expect(setStatus).toHaveBeenCalledWith('active');
    expect(loadInstance).toHaveBeenCalledWith('demo');
    expect(activateInstance).toHaveBeenCalledWith('demo');
    expect(suspendInstance).toHaveBeenCalledWith('demo');
    expect(archiveInstance).toHaveBeenCalledWith('demo');
  });

  it('submits the create form, trims values and resets on success', async () => {
    const createInstance = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance }));

    render(<InstancesPage />);

    fireEvent.change(screen.getByLabelText('Instanz-ID'), { target: { value: ' demo ' } });
    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: ' Demo ' } });
    fireEvent.change(screen.getByLabelText('Parent-Domain'), { target: { value: ' studio.example.org ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(createInstance).toHaveBeenCalledWith({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
      });
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Instanz-ID') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Anzeigename') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Parent-Domain') as HTMLInputElement).value).toBe(' studio.example.org ');
    });
  });

  it('renders api-specific error states and selected instance details', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        error: { status: 403, code: 'forbidden', message: 'forbidden' },
        mutationError: { status: 409, code: 'conflict', message: 'conflict' },
        selectedInstance: {
          instanceId: 'demo',
          displayName: 'Demo',
          status: 'suspended',
          parentDomain: 'studio.example.org',
          primaryHostname: 'demo.studio.example.org',
          hostnames: [{ hostname: 'demo.studio.example.org', isPrimary: true, createdAt: '2026-01-01T00:00:00.000Z' }],
          provisioningRuns: [
            {
              id: 'run-1',
              operation: 'activate',
              status: 'active',
            },
          ],
          auditEvents: [],
        },
      })
    );

    render(<InstancesPage />);

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(within(alerts[0]!).getByText('Keine Berechtigung für die Instanzverwaltung.')).toBeTruthy();
    expect(within(alerts[1]!).getByText('Die gewünschte Änderung steht im Konflikt mit dem aktuellen Instanzstatus.')).toBeTruthy();
    expect(screen.getByText('Primärer Hostname: demo.studio.example.org')).toBeTruthy();
    expect(screen.getByText('Parent-Domain: studio.example.org')).toBeTruthy();
    expect(screen.getByText('Status: Suspendiert')).toBeTruthy();
    expect(screen.getByText('activate')).toBeTruthy();
    expect(screen.getByText('Laufstatus: Aktiv')).toBeTruthy();
  });
});
