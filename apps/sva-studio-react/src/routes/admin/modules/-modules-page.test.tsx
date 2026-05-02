import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModulesPage } from './-modules-page';

const useInstancesMock = vi.fn();

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

vi.mock('../../../lib/plugins', () => ({
  studioPluginModuleIamContracts: [
    {
      moduleId: 'news',
      permissionIds: ['news.read', 'news.write'],
      systemRoles: [{ roleName: 'news_admin', permissionIds: ['news.read', 'news.write'] }],
    },
    {
      moduleId: 'events',
      permissionIds: ['events.read'],
      systemRoles: [{ roleName: 'events_admin', permissionIds: ['events.read'] }],
    },
  ],
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
  selectedInstance: {
    instanceId: 'demo',
    displayName: 'Demo',
    status: 'active',
    parentDomain: 'studio.example.org',
    primaryHostname: 'demo.studio.example.org',
    assignedModules: ['news'],
  },
  isLoading: false,
  detailLoading: false,
  statusLoading: false,
  mutationError: null,
  loadInstance: vi.fn().mockResolvedValue(true),
  assignModule: vi.fn().mockResolvedValue(true),
  revokeModule: vi.fn().mockResolvedValue(true),
  seedIamBaseline: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('ModulesPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
  });

  it('selects the first instance automatically, loads details, and renders assigned and available modules', async () => {
    const loadInstance = vi.fn().mockResolvedValue(true);
    const assignModule = vi.fn().mockResolvedValue(true);
    const revokeModule = vi.fn().mockResolvedValue(true);
    const seedIamBaseline = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        loadInstance,
        assignModule,
        revokeModule,
        seedIamBaseline,
      })
    );

    render(<ModulesPage />);

    await waitFor(() => {
      expect(loadInstance).toHaveBeenCalledWith('demo');
    });

    expect(screen.getByDisplayValue('Demo (demo)')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modul entziehen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modul zuweisen' }));

    expect(seedIamBaseline).toHaveBeenCalledWith('demo');
    expect(revokeModule).toHaveBeenCalledWith('demo', 'news');
    expect(assignModule).toHaveBeenCalledWith('demo', 'events');
  });

  it('does not reload the selected instance on rerender when loadInstance is stable', async () => {
    const loadInstance = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockImplementation(() =>
      createInstancesApiState({
        loadInstance,
      })
    );

    const { rerender } = render(<ModulesPage />);

    await waitFor(() => {
      expect(loadInstance).toHaveBeenCalledTimes(1);
      expect(loadInstance).toHaveBeenCalledWith('demo');
    });

    rerender(<ModulesPage />);

    await waitFor(() => {
      expect(loadInstance).toHaveBeenCalledTimes(1);
    });
  });

  it('renders mutation errors and the empty fallback when no selected instance detail is available', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: null,
        mutationError: { status: 403, code: 'forbidden', message: 'forbidden' },
      })
    );

    render(<ModulesPage />);

    expect(screen.getByRole('alert').textContent).toContain('Keine Berechtigung');
    expect(screen.getByText('Wählen Sie eine Instanz aus, um Modulzuweisungen zu verwalten.')).toBeTruthy();
  });
});
