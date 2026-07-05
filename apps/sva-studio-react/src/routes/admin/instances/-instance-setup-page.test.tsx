import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstanceSetupPage } from './-instance-setup-page';

const useInstancesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; params?: Record<string, string> }) => (
    <a href={params?.instanceId ? to.replace('$instanceId', params.instanceId) : to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

vi.mock('../../../lib/plugins', () => ({
  studioModuleIamContracts: [
    {
      moduleId: 'categories',
      namespace: 'categories',
      ownerPluginId: 'categories',
      descriptionKey: 'plugins.categories.description',
      permissionIds: ['categories.read'],
      systemRoles: [],
    },
    {
      moduleId: 'news',
      namespace: 'news',
      ownerPluginId: 'news',
      descriptionKey: 'plugins.news.description',
      permissionIds: ['news.read'],
      systemRoles: [],
    },
    {
      moduleId: 'events',
      namespace: 'events',
      ownerPluginId: 'events',
      descriptionKey: 'plugins.events.description',
      permissionIds: ['events.read'],
      systemRoles: [],
    },
    {
      moduleId: 'generic-items',
      namespace: 'generic-items',
      ownerPluginId: 'generic-items',
      descriptionKey: 'plugins.generic-items.description',
      permissionIds: ['generic-items.read'],
      systemRoles: [],
    },
    {
      moduleId: 'surveys',
      namespace: 'surveys',
      ownerPluginId: 'surveys',
      descriptionKey: 'plugins.surveys.description',
      permissionIds: ['surveys.read'],
      systemRoles: [],
    },
  ],
}));

const createAuditEvent = (eventType: 'instance_admin_bootstrapped') => ({
  id: `${eventType}-1`,
  instanceId: 'demo',
  eventType,
  details: {},
  createdAt: '2026-06-06T10:00:00.000Z',
});

const createSelectedInstance = (overrides: Record<string, unknown> = {}) => ({
  instanceId: 'demo',
  displayName: 'Demo',
  status: 'requested',
  parentDomain: 'studio.example.org',
  primaryHostname: 'demo.studio.example.org',
  realmMode: 'existing',
  authRealm: 'demo',
  authClientId: 'sva-studio-login',
  authClientSecretConfigured: true,
  tenantAdminClient: {
    clientId: 'sva-studio-realm-admin',
    secretConfigured: true,
  },
  hostnames: [],
  provisioningRuns: [],
  auditEvents: [],
  keycloakPreflight: {
    overallStatus: 'ready',
    generatedAt: '2026-01-01T00:00:00.000Z',
    checks: [
      {
        checkKey: 'keycloak_admin_access',
        status: 'ready',
        title: 'Keycloak erreichbar',
        summary: 'Technischer Zugriff ist vorhanden.',
        details: {},
      },
    ],
  },
  keycloakPlan: {
    mode: 'existing',
    overallStatus: 'ready',
    generatedAt: '2026-01-01T00:00:00.000Z',
    driftSummary: 'Kein Drift.',
    steps: [],
  },
  keycloakProvisioningRuns: [],
  tenantAdminBootstrap: {
    username: 'demo-admin',
    email: 'demo@example.org',
    firstName: 'Demo',
    lastName: 'Admin',
  },
  keycloakStatus: {
    realmExists: true,
    clientExists: true,
    tenantAdminClientExists: true,
    tenantAdminExists: true,
    tenantAdminHasSystemAdmin: true,
    redirectUrisMatch: true,
    logoutUrisMatch: true,
    webOriginsMatch: true,
    clientSecretConfigured: true,
    tenantClientSecretReadable: true,
    clientSecretAligned: true,
    tenantAdminClientSecretConfigured: true,
    tenantAdminClientSecretReadable: true,
    tenantAdminClientSecretAligned: true,
    runtimeSecretSource: 'tenant',
  },
  latestKeycloakProvisioningRun: {
    id: 'run-1',
    intent: 'provision',
    mode: 'existing',
    overallStatus: 'succeeded',
    driftSummary: 'Kein Drift.',
    requestId: 'req-1',
    createdAt: '2026-06-06T10:00:00.000Z',
    updatedAt: '2026-06-06T10:00:00.000Z',
    steps: [],
  },
  tenantIamStatus: {
    configuration: { status: 'ready', summary: 'Konfiguration ok', source: 'registry' },
    access: { status: 'ready', summary: 'Zugriff ok', source: 'access_probe' },
    reconcile: { status: 'ready', summary: 'Kein Backlog', source: 'role_reconcile' },
    overall: { status: 'ready', summary: 'Bereit', source: 'role_reconcile' },
  },
  assignedModules: [],
  ...overrides,
});

const createInstancesApiState = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
  selectedInstance: createSelectedInstance(),
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
  refreshKeycloakPreflight: vi.fn().mockResolvedValue(true),
  planKeycloakProvisioning: vi.fn().mockResolvedValue(true),
  executeKeycloakProvisioning: vi.fn().mockResolvedValue(true),
  loadKeycloakProvisioningRun: vi.fn().mockResolvedValue(true),
  refreshKeycloakStatus: vi.fn().mockResolvedValue(true),
  probeTenantIamAccess: vi.fn().mockResolvedValue(true),
  reconcileKeycloak: vi.fn().mockResolvedValue(true),
  activateInstance: vi.fn().mockResolvedValue(true),
  suspendInstance: vi.fn().mockResolvedValue(true),
  archiveInstance: vi.fn().mockResolvedValue(true),
  seedIamBaseline: vi.fn().mockResolvedValue(true),
  assignModule: vi.fn().mockResolvedValue(true),
  revokeModule: vi.fn().mockResolvedValue(true),
  bootstrapAdminStructure: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('InstanceSetupPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
  });

  it('renders a focused setup flow instead of the full detail cockpit', async () => {
    const loadInstance = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockReturnValue(createInstancesApiState({ loadInstance }));

    render(<InstanceSetupPage instanceId="demo" />);

    await waitFor(() => {
      expect(loadInstance).toHaveBeenCalledWith('demo');
    });

    expect(screen.getByRole('heading', { name: 'Setup abschließen' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Kategorien/u })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Umfragen/u })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Generic Items/u })).toBeTruthy();
    expect(screen.getByText('Setup-Status')).toBeTruthy();
    expect(screen.getByText('Tenant-Admin-Struktur')).toBeTruthy();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Zur Betriebsansicht wechseln' })).toBeNull();
  });

  it('bootstraps the admin structure with selected modules but keeps setup incomplete until activation', async () => {
    const instancesApiState = createInstancesApiState() as ReturnType<typeof createInstancesApiState> & {
      selectedInstance: ReturnType<typeof createSelectedInstance>;
    };
    instancesApiState.bootstrapAdminStructure = vi.fn().mockImplementation(async (_instanceId: string, moduleIds: readonly string[]) => {
      instancesApiState.selectedInstance = createSelectedInstance({
        auditEvents: [createAuditEvent('instance_admin_bootstrapped')],
        assignedModules: [...moduleIds],
      });
      return instancesApiState.selectedInstance;
    });
    useInstancesMock.mockImplementation(() => instancesApiState);

    render(<InstanceSetupPage instanceId="demo" />);

    fireEvent.click(screen.getByText(/news\.read/u));
    fireEvent.click(screen.getByRole('button', { name: 'Tenant-Admin-Struktur jetzt anlegen' }));

    await waitFor(() => {
      expect(instancesApiState.bootstrapAdminStructure).toHaveBeenCalledWith('demo', ['news']);
    });

    expect(screen.getByText('Die Tenant-Admin-Struktur wurde erfolgreich synchronisiert. Der Setup-Schritt ist damit abgeschlossen.')).toBeTruthy();
    expect(screen.getByText('Setup noch nicht abgeschlossen. Prüfen Sie zuerst die beiden Pflichtschritte.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Zur Betriebsansicht wechseln' })).toBeNull();
  });

  it('shows the operations handoff only after activation and admin bootstrap are complete', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          status: 'active',
          auditEvents: [createAuditEvent('instance_admin_bootstrapped')],
        }),
      })
    );

    render(<InstanceSetupPage instanceId="demo" />);

    expect(screen.getByText('Setup abgeschlossen. Sie können jetzt in den normalen Betrieb wechseln.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zur Betriebsansicht wechseln' }).getAttribute('href')).toBe(
      '/admin/instances/demo'
    );
  });
});
