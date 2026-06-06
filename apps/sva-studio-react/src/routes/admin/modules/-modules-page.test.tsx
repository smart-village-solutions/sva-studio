import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { studioModuleIamContracts as realStudioModuleIamContracts } from '@sva/studio-module-iam';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ModulesPage } from './-modules-page';

const useInstancesMock = vi.fn();
const useAuthMock = vi.fn();

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../components/ConfirmDialog', () => ({
  ConfirmDialog: ({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <p>{description}</p>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock('../../../lib/plugins', () => ({
  studioModuleIamContracts: realStudioModuleIamContracts,
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
  bootstrapAdminStructure: vi.fn().mockResolvedValue(true),
  ...overrides,
});

const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('ModulesPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      user: null,
    });
  });

  it('selects the first instance automatically, loads details, and renders assigned and available modules', async () => {
    const loadInstance = vi.fn().mockResolvedValue(true);
    const assignModule = vi.fn().mockResolvedValue(true);
    const revokeModule = vi.fn().mockResolvedValue(true);
    const seedIamBaseline = vi.fn().mockResolvedValue(true);
    const bootstrapAdminStructure = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        loadInstance,
        assignModule,
        revokeModule,
        seedIamBaseline,
        bootstrapAdminStructure,
      })
    );

    render(<ModulesPage />);

    await waitFor(() => {
      expect(loadInstance).toHaveBeenCalledWith('demo');
    });

    expect(realStudioModuleIamContracts.every((module) => module.descriptionKey.length > 0)).toBe(true);

    expect(screen.getByDisplayValue('Demo (demo)')).toBeTruthy();
    expect(screen.getByText('Module schalten Bereiche frei')).toBeTruthy();
    expect(screen.getByText('Rollen vergeben Berechtigungen')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();
    expect(screen.getByText('media')).toBeTruthy();
    expect(screen.getByText('waste-management')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tenant-Admin-Struktur initialisieren' }));
    expect(screen.getByRole('dialog', { name: 'Tenant-Admin-Struktur wirklich initialisieren?' })).toBeTruthy();
    expect(bootstrapAdminStructure).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tenant-Admin-Struktur initialisieren' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Modul entziehen' }));
    expect(screen.getByRole('dialog', { name: 'Modul wirklich entziehen?' })).toBeTruthy();
    expect(revokeModule).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Modul entziehen' })[1]!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Modul zuweisen' })[0]!);

    expect(seedIamBaseline).toHaveBeenCalledWith('demo');
    expect(bootstrapAdminStructure).toHaveBeenCalledWith('demo', ['news']);
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

  it('keeps the revoke dialog open until the revoke request succeeds', async () => {
    const revokeDeferred = createDeferred<boolean>();
    const revokeModule = vi.fn(() => revokeDeferred.promise);
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        revokeModule,
      })
    );

    render(<ModulesPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Modul entziehen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Modul entziehen' })[1]!);

    expect(revokeModule).toHaveBeenCalledWith('demo', 'news');
    expect(screen.getByRole('dialog', { name: 'Modul wirklich entziehen?' })).toBeTruthy();

    revokeDeferred.resolve(true);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Modul wirklich entziehen?' })).toBeNull();
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

  it('renders a read-only tenant module table when the session has an instance context', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'tenant-user',
        instanceId: 'de-musterhausen',
        assignedModules: ['news', 'media'],
      },
    });

    render(<ModulesPage />);

    expect(screen.getByText('IAM-Basis der Module')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();
    expect(screen.getAllByText('Aktiv')).toHaveLength(2);
    expect(screen.getAllByText('Deaktiviert').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Modul zuweisen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'IAM-Basis neu aufbauen' })).toBeNull();
    expect(useInstancesMock).not.toHaveBeenCalled();
  });
});
