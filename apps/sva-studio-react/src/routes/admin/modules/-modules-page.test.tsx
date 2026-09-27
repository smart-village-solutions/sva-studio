import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { definePluginManifest } from '@sva/plugin-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStudioModuleIamContracts,
  studioHostModuleIamContracts,
  studioModuleIamContracts,
  studioPluginSnapshot,
} from '../../../lib/plugins';
import { createStudioPluginCatalogReport } from '../../../lib/plugin-catalog-loader';
import { ModulesPage } from './-modules-page';

const useInstancesMock = vi.fn();
const useAuthMock = vi.fn();
const readinessState = vi.hoisted(() => ({ items: [] as unknown[], error: null as unknown }));

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

vi.mock('../../../providers/auth-provider', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../../providers/effective-access-provider', () => ({
  useEffectiveAuth: () => useAuthMock(),
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

vi.mock('../../../hooks/use-plugin-tenant-readiness', () => ({
  usePluginTenantReadiness: () => ({
    items: readinessState.items,
    isLoading: false,
    activeAction: null,
    error: readinessState.error,
    refresh: vi.fn(),
    startRepair: vi.fn(),
  }),
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
  beforeEach(() => {
    readinessState.items = [];
    readinessState.error = null;
  });
  it('projects only validated plugin contracts plus host modules', () => {
    expect(studioModuleIamContracts.map((contract) => contract.moduleId)).toEqual([
      ...studioPluginSnapshot.registry.pluginModuleIamContracts.map(
        (contract) => contract.moduleId
      ),
      'media',
    ]);
    expect(
      createStudioModuleIamContracts([], studioHostModuleIamContracts).map(
        (contract) => contract.moduleId
      )
    ).toEqual(['media']);
    expect(
      createStudioModuleIamContracts(
        [
          {
            moduleId: 'additional-plugin',
            namespace: 'additional-plugin',
            ownerPluginId: 'additional-plugin',
            permissionIds: ['additional-plugin.read'],
            systemRoles: [],
          },
        ],
        studioHostModuleIamContracts
      ).map((contract) => contract.moduleId)
    ).toEqual(['additional-plugin', 'media']);
  });

  it('excludes disabled, incompatible and removed plugins from the assignable catalog', async () => {
    const report = await createStudioPluginCatalogReport({
      catalogConfig: [
        {
          pluginId: 'additional-plugin',
          sourceType: 'workspace',
          enabled: true,
          sourceRef: 'additional',
        },
        {
          pluginId: 'disabled-plugin',
          sourceType: 'workspace',
          enabled: false,
          sourceRef: 'disabled',
        },
        {
          pluginId: 'incompatible-plugin',
          sourceType: 'workspace',
          enabled: true,
          sourceRef: 'incompatible',
        },
      ],
      resolveManifest: (entry) =>
        definePluginManifest({
          pluginId: entry.pluginId,
          manifestVersion: 1,
          extensionTier: 'feature',
          tenantActivationPolicy: 'optional',
          version: '0.0.1',
          sdkVersion: '0.0.1',
          hostCompatibility: {
            studioVersionRange: entry.pluginId === 'incompatible-plugin' ? '^99.0.0' : '^0.0.1',
            requiredCapabilities: ['iam'],
          },
          entryPoints: { browser: './dist/index.js' },
        }),
      resolvePluginModule: async (entry) => ({
        plugin: {
          id: entry.pluginId,
          displayName: entry.pluginId,
          routes: [],
          permissions: [{ id: `${entry.pluginId}.read`, titleKey: 'plugin.read' }],
          moduleIam: {
            moduleId: entry.pluginId,
            permissionIds: [`${entry.pluginId}.read`],
            systemRoles: [],
          },
          translations: {},
        },
      }),
    });

    expect(
      report.snapshot.registry.pluginModuleIamContracts.map((contract) => contract.moduleId)
    ).toEqual(['additional-plugin']);
    expect(
      createStudioModuleIamContracts(
        report.snapshot.registry.pluginModuleIamContracts,
        studioHostModuleIamContracts
      ).map((contract) => contract.moduleId)
    ).toEqual(['additional-plugin', 'media']);
    expect(report.issues.some((issue) => issue.pluginId === 'incompatible-plugin')).toBe(true);
  });

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

    expect(studioModuleIamContracts.every((module) => module.descriptionKey.length > 0)).toBe(true);

    expect(screen.getByDisplayValue('Demo (demo)')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('categories')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();
    expect(screen.getAllByText('media').length).toBeGreaterThan(0);
    expect(screen.getByText('waste-management')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole('button', {
            name: 'Tenant-Admin-Struktur initialisieren',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tenant-Admin-Struktur initialisieren' }));
    expect(
      screen.getByRole('dialog', { name: 'Tenant-Admin-Struktur wirklich initialisieren?' })
    ).toBeTruthy();
    expect(bootstrapAdminStructure).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Tenant-Admin-Struktur initialisieren' })[1]!
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Modul entziehen' }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: 'Modul entziehen' }));
    expect(screen.getByRole('dialog', { name: 'Modul wirklich entziehen?' })).toBeTruthy();
    expect(revokeModule).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Modul entziehen' })[1]!);
    await waitFor(() =>
      expect(
        (screen.getAllByRole('button', { name: 'Modul zuweisen' })[0] as HTMLButtonElement).disabled
      ).toBe(false)
    );
    const eventsModuleCard = screen.getByRole('region', { name: 'events' });
    expect(eventsModuleCard).toBeTruthy();
    fireEvent.click(
      within(eventsModuleCard as HTMLElement).getByRole('button', { name: 'Modul zuweisen' })
    );

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

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Modul entziehen' }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
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
    expect(
      screen.getByText('Wählen Sie eine Instanz aus, um Modulzuweisungen zu verwalten.')
    ).toBeTruthy();
  });

  it('renders a read-only tenant module table when the session has an instance context', () => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'tenant-user',
        instanceId: 'de-musterhausen',
        assignedModules: ['news', 'media', 'removed-plugin'],
      },
    });

    render(<ModulesPage />);

    expect(screen.getByText('IAM-Basis der Module')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();
    expect(screen.getAllByText('Aktiv')).toHaveLength(2);
    expect(screen.getAllByText('Deaktiviert').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('removed-plugin')).toBeTruthy();
    expect(screen.getByText('Nicht verfügbar (historische Zuweisung)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Modul zuweisen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'IAM-Basis neu aufbauen' })).toBeNull();
    expect(useInstancesMock).not.toHaveBeenCalled();
  });

  it('keeps an assigned pending lifecycle separate from assignment and blocks duplicate actions', async () => {
    const lifecycle = studioPluginSnapshot.registry.tenantLifecycles[0];
    expect(lifecycle).toBeDefined();
    const contract = studioPluginSnapshot.registry.pluginModuleIamContracts.find(
      (entry) => entry.ownerPluginId === lifecycle.pluginId
    )!;
    expect(contract).toBeDefined();
    readinessState.items = [
      {
        pluginId: lifecycle.pluginId,
        status: 'pending',
        activationPolicy: 'optional',
        desiredGeneration: 1,
        completedGeneration: 0,
        checks: [],
      },
    ];
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: { instanceId: 'demo', assignedModules: [contract.moduleId] },
      })
    );
    render(<ModulesPage />);
    expect(
      within(screen.getAllByRole('region', { name: contract.moduleId })[0]!).getByText(
        /Bereitschaft:/
      ).textContent
    ).not.toContain('Nicht verifiziert');
    expect(screen.getAllByText(/Keine technische Prüfung vorgesehen/).length).toBeGreaterThan(0);
  });

  it('keeps required modules without readiness unverified and non-revocable', () => {
    const lifecycle = studioPluginSnapshot.registry.tenantLifecycles[0];
    const contract = studioPluginSnapshot.registry.pluginModuleIamContracts.find(
      (entry) => entry.ownerPluginId === lifecycle.pluginId
    )!;
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: {
          instanceId: 'demo',
          assignedModules: [contract.moduleId],
          moduleActivations: [
            {
              moduleId: contract.moduleId,
              activationPolicy: 'required',
              activationOrigin: 'policy_reconcile',
              effectiveActive: true,
            },
          ],
        },
      })
    );
    render(<ModulesPage />);
    const row = within(screen.getAllByRole('region', { name: contract.moduleId })[0]!);
    expect(row.getByText('Bereitschaft: Nicht verifiziert')).toBeTruthy();
    expect(
      (row.getByRole('button', { name: 'Modul entziehen' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('accepts an empty assignment set and sends only one assignment while pending', async () => {
    const pending = createDeferred<boolean>();
    const assignModule = vi.fn(() => pending.promise);
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        assignModule,
        selectedInstance: { instanceId: 'demo', assignedModules: [] },
      })
    );
    render(<ModulesPage />);
    expect(screen.queryByRole('button', { name: 'Modul entziehen' })).toBeNull();
    const assign = within(screen.getByRole('region', { name: 'news' })).getByRole('button', {
      name: 'Modul zuweisen',
    });
    fireEvent.click(assign);
    fireEvent.click(assign);
    expect(assignModule).toHaveBeenCalledTimes(1);
    pending.resolve(true);
    await waitFor(() => expect((assign as HTMLButtonElement).disabled).toBe(false));
  });

  it('keeps historical assignments visible without offering them as available modules', () => {
    const bootstrapAdminStructure = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        bootstrapAdminStructure,
        selectedInstance: {
          instanceId: 'demo',
          assignedModules: ['news'],
          moduleActivations: [{ moduleId: 'removed-plugin', effectiveActive: false }],
        },
      })
    );

    render(<ModulesPage />);

    expect(screen.getByText('removed-plugin')).toBeTruthy();
    expect(screen.getByText('Nicht verfügbar (historische Zuweisung)')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Modul zuweisen' }).length).toBe(
      studioModuleIamContracts.length - 1
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tenant-Admin-Struktur initialisieren' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Tenant-Admin-Struktur initialisieren' })[1]!
    );
    expect(bootstrapAdminStructure).toHaveBeenCalledWith('demo', ['news']);
  });
});
