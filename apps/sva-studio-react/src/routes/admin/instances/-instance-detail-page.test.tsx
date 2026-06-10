import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstanceDetailPage, readActionFeedbackClassName } from './-instance-detail-page';

const useInstancesMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

const { mockStudioModuleIamContracts } = vi.hoisted(() => ({
  mockStudioModuleIamContracts: [
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
      moduleId: 'media',
      namespace: 'media',
      ownerPluginId: 'host',
      descriptionKey: 'host.media.description',
      permissionIds: ['media.read'],
      systemRoles: [],
    },
  ],
}));

vi.mock('../../../lib/plugins', () => ({
  studioModuleIamContracts: mockStudioModuleIamContracts,
}));

const activateTab = async (name: string) => {
  const tab = screen.getByRole('tab', { name });
  tab.focus();
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
  fireEvent.keyDown(tab, { key: 'Enter' });
  await waitFor(() => {
    expect(screen.getByRole('tab', { name }).getAttribute('data-state')).toBe('active');
  });
};

const openDoctor = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Doctor öffnen' }));
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: 'Doctor' }).getAttribute('data-state')).toBe('active');
  });
};

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
      },
    ],
  },
  keycloakPlan: {
    mode: 'existing',
    overallStatus: 'ready',
    generatedAt: '2026-01-01T00:00:00.000Z',
    driftSummary: 'Kein Drift.',
    steps: [
      {
        stepKey: 'client',
        action: 'noop',
        title: 'Client prüfen',
        summary: 'Keine Änderung erforderlich.',
      },
    ],
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
    steps: [],
  },
  tenantIamStatus: {
    configuration: { status: 'ready', summary: 'Konfiguration ok', source: 'registry' },
    access: { status: 'unknown', summary: 'Noch keine Probe', source: 'access_probe' },
    reconcile: { status: 'degraded', summary: 'Backlog vorhanden', source: 'role_reconcile' },
    overall: { status: 'degraded', summary: 'Eingeschränkt', source: 'role_reconcile' },
  },
  ...overrides,
});

const createInstancesApiState = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
  selectedInstance: createSelectedInstance(),
  instancesAuditRun: null,
  instanceAuditRun: null,
  isLoading: false,
  detailLoading: false,
  statusLoading: false,
  auditLoading: false,
  error: null,
  mutationError: null as
    | {
        status: number;
        code: string;
        message: string;
        classification?: string;
        recommendedAction?: string;
        requestId?: string;
      }
    | null,
  filters: {
    search: '',
    status: 'all',
  },
  setSearch: vi.fn(),
  setStatus: vi.fn(),
  refetch: vi.fn(),
  loadInstance: vi.fn().mockResolvedValue(true),
  refreshInstancesAudit: vi.fn().mockResolvedValue(true),
  refreshInstanceAudit: vi.fn().mockResolvedValue(true),
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

describe('InstanceDetailPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the detail page, shows the new overview first, and saves configuration changes', async () => {
    const loadInstance = vi.fn().mockResolvedValue(true);
    const updateInstance = vi.fn().mockResolvedValue(true);
    const refreshKeycloakStatus = vi.fn().mockResolvedValue(true);
    const reconcileKeycloak = vi.fn().mockResolvedValue(true);

    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        loadInstance,
        updateInstance,
        refreshKeycloakStatus,
        reconcileKeycloak,
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    await waitFor(() => {
      expect(loadInstance).toHaveBeenCalledWith('demo');
    });

    expect(screen.getByRole('tab', { name: 'Betrieb' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Doctor' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Einstellungen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Doctor öffnen' })).toBeTruthy();
    expect(screen.getByText('Doctor erkennt aktuell Handlungsbedarf.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Doctor öffnen' }));

    expect(screen.getByText('Überblick')).toBeTruthy();
    expect(screen.getByText('Empfohlene Maßnahme')).toBeTruthy();
    expect(screen.getByText('Reparatur ausführen')).toBeTruthy();
    expect(screen.getByText('Validieren')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Keycloak-Status prüfen' }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: 'Keycloak-Status prüfen' })[0]!);
    await waitFor(() => {
      expect(refreshKeycloakStatus).toHaveBeenCalledWith('demo');
      expect(reconcileKeycloak).not.toHaveBeenCalled();
    });

    await activateTab('Einstellungen');

    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#detail-display-name' }), {
      target: { value: ' Demo Updated ' },
    });
    fireEvent.change(screen.getByLabelText('Parent-Domain', { selector: '#detail-parent-domain' }), {
      target: { value: ' studio.example.org ' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#detail-auth-realm' }), {
      target: { value: ' demo-updated ' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#detail-auth-client-id' }), {
      target: { value: ' tenant-client ' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Issuer-URL', { selector: '#detail-auth-issuer-url' }), {
      target: { value: ' https://issuer.example.org ' },
    });
    fireEvent.change(screen.getByLabelText('Tenant-Client-Secret', { selector: '#detail-auth-client-secret' }), {
      target: { value: ' test-client-secret ' },
    });
    fireEvent.change(screen.getByLabelText('Tenant-Admin-Client-ID', { selector: '#detail-tenant-admin-client-id' }), {
      target: { value: ' tenant-admin-client ' },
    });
    fireEvent.change(screen.getByLabelText('Tenant-Admin-Client-Secret', { selector: '#detail-tenant-admin-client-secret' }), {
      target: { value: ' test-admin-client-secret ' },
    });
    fireEvent.change(screen.getByLabelText('Admin-Benutzername', { selector: '#detail-admin-username' }), {
      target: { value: ' updated-admin ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Instanz speichern' }));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledWith('demo', {
        displayName: 'Demo Updated',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'demo-updated',
        authClientId: 'tenant-client',
        authIssuerUrl: 'https://issuer.example.org',
        authClientSecret: 'test-client-secret',
        tenantAdminClient: {
          clientId: 'tenant-admin-client',
          secret: 'test-admin-client-secret',
        },
        tenantAdminBootstrap: {
          username: 'updated-admin',
          email: 'demo@example.org',
          firstName: 'Demo',
          lastName: 'Admin',
        },
      });
    });

    await waitFor(() => {
      expect(
        (screen.getByLabelText('Tenant-Client-Secret', { selector: '#detail-auth-client-secret' }) as HTMLInputElement).value
      ).toBe('');
      expect(
        (screen.getByLabelText('Tenant-Admin-Client-Secret', { selector: '#detail-tenant-admin-client-secret' }) as HTMLInputElement)
          .value
      ).toBe('');
    });
  });

  it('shows a visible tenant-admin reset action inside the doctor repair step and triggers the existing repair intent', async () => {
    const executeKeycloakProvisioning = vi.fn().mockResolvedValue(true);
    const loadInstance = vi.fn().mockResolvedValue(true);

    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        executeKeycloakProvisioning,
        loadInstance,
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    fireEvent.click(screen.getByRole('button', { name: 'Doctor öffnen' }));
    expect(screen.getByRole('tab', { name: 'Doctor' }).getAttribute('data-state')).toBe('active');

    fireEvent.click(screen.getByRole('button', { name: 'Tenant-Admin neu setzen' }));

    await waitFor(() => {
      expect(executeKeycloakProvisioning).toHaveBeenCalledWith('demo', {
        intent: 'reset_tenant_admin',
        tenantAdminTemporaryPassword: undefined,
      });
    });
    expect(loadInstance).toHaveBeenCalledWith('demo');
  });

  it('shows a visible warning when a provisioning run stays queued without a worker', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-05-06T12:00:00.000Z').getTime());

    const loadInstance = vi.fn().mockResolvedValue(true);

    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        loadInstance,
        selectedInstance: createSelectedInstance({
          realmMode: 'new',
          latestKeycloakProvisioningRun: {
            id: 'run-queued-1',
            intent: 'provision',
            mode: 'new',
            overallStatus: 'planned',
            driftSummary: 'Provisioning-Auftrag erstellt und für den Worker vorgemerkt.',
            requestId: 'req-queued-1',
            createdAt: '2026-05-06T11:59:00.000Z',
            updatedAt: '2026-05-06T11:59:00.000Z',
            steps: [
              {
                stepKey: 'queued',
                title: 'Provisioning-Auftrag einreihen',
                status: 'pending',
                summary: 'Der Auftrag wurde gespeichert und wartet auf die Abarbeitung durch den Provisioning-Worker.',
                details: {},
              },
            ],
          },
          keycloakProvisioningRuns: [
            {
              id: 'run-queued-1',
              intent: 'provision',
              mode: 'new',
              overallStatus: 'planned',
              driftSummary: 'Provisioning-Auftrag erstellt und für den Worker vorgemerkt.',
              requestId: 'req-queued-1',
              createdAt: '2026-05-06T11:59:00.000Z',
              updatedAt: '2026-05-06T11:59:00.000Z',
              steps: [
                {
                  stepKey: 'queued',
                  title: 'Provisioning-Auftrag einreihen',
                  status: 'pending',
                  summary: 'Der Auftrag wurde gespeichert und wartet auf die Abarbeitung durch den Provisioning-Worker.',
                  details: {},
                },
              ],
            },
          ],
        }),
      }),
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(loadInstance).toHaveBeenCalledWith('demo');
    expect(screen.getByRole('button', { name: 'Doctor öffnen' })).toBeTruthy();

    expect(
      screen.getByText(
        'Für diesen Provisioning-Auftrag hat noch kein Worker übernommen. Bitte den Provisioning-Worker prüfen oder lokal starten und den Lauf danach erneut anstoßen.',
      ),
    ).toBeTruthy();
  });

  it('computes transient action feedback classes for visible and fading states', () => {
    expect(readActionFeedbackClassName({ tone: 'success', message: 'ok' }, false)).toContain('opacity-100');
    expect(readActionFeedbackClassName({ tone: 'success', message: 'ok' }, true)).toContain('opacity-0');
    expect(readActionFeedbackClassName({ tone: 'success', message: 'ok' }, false)).toContain('border-emerald-500/40');
    expect(readActionFeedbackClassName({ tone: 'warning', message: 'warn' }, false)).toContain('border-amber-500/40');
  });

  it('keeps older runs behind the history tab and shows the mismatch hint there', async () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          status: 'active',
          latestKeycloakProvisioningRun: {
            id: 'run-current',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'succeeded',
            driftSummary: 'Aktueller Run erfolgreich.',
            requestId: 'req-current',
            steps: [],
          },
          keycloakProvisioningRuns: [
            {
              id: 'run-older',
              intent: 'provision',
              mode: 'existing',
              overallStatus: 'failed',
              driftSummary: 'Älterer Run fehlgeschlagen.',
              requestId: 'req-older',
              steps: [],
            },
          ],
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(screen.queryByText('Älterer Run fehlgeschlagen.')).toBeNull();

    await activateTab('Doctor');

    await waitFor(() => {
      expect(screen.getByText('Historie')).toBeTruthy();
      expect(screen.getByText('Älterer Run fehlgeschlagen.')).toBeTruthy();
      expect(
        screen.getByText(
          'Ältere Fehl-Läufe sind weiterhin sichtbar, repräsentieren aber nicht den aktuellen Hauptzustand.'
        )
      ).toBeTruthy();
    });
  });

  it('keeps the detail page usable when keycloak is unavailable', async () => {
    const refreshKeycloakPreflight = vi.fn().mockResolvedValue(true);

    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: { status: 502, code: 'keycloak_unavailable', message: 'kaputt' },
        selectedInstance: createSelectedInstance({
          keycloakPreflight: undefined,
          keycloakStatus: undefined,
          latestKeycloakProvisioningRun: undefined,
          keycloakProvisioningRuns: [],
        }),
        refreshKeycloakPreflight,
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    await openDoctor();
    fireEvent.click(screen.getByRole('button', { name: 'Vorbedingungen prüfen' }));

    await waitFor(() => {
      expect(refreshKeycloakPreflight).toHaveBeenCalledWith('demo');
    });
  });

  it('renders all known modules with derived activation status and translated descriptions in the modules tab', async () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          assignedModules: ['news', 'media'],
          moduleIamStatus: undefined,
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    await activateTab('Betrieb');

    expect(await screen.findByText('news')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();
    expect(screen.getByText('media')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Modul entziehen' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Modul zuweisen' })).toHaveLength(1);

    expect(screen.getByText('Veröffentlicht Nachrichten und redaktionelle Meldungen für den Mandanten.')).toBeTruthy();
    expect(screen.getByText('Veröffentlicht Termine und Veranstaltungsdaten für den Mandanten.')).toBeTruthy();
    expect(screen.getByText('Aktiviert die Medienverwaltung für Uploads, Referenzen und geschützte Auslieferung.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' })).toBeTruthy();
  });

  it('shows action feedback in the overview and clears stale feedback before a later failure', async () => {
    const apiState = createInstancesApiState({
      selectedInstance: createSelectedInstance({
        keycloakPreflight: undefined,
        keycloakStatus: undefined,
        latestKeycloakProvisioningRun: undefined,
        keycloakProvisioningRuns: [],
      }),
    }) as ReturnType<typeof createInstancesApiState> & {
      mutationError: { status: number; code: string; message: string } | null;
    };
    apiState.refreshKeycloakPreflight = vi.fn().mockResolvedValue({ overallStatus: 'ready', checks: [] });
    apiState.refreshKeycloakStatus = vi.fn().mockResolvedValue(false);
    apiState.mutationError = null;

    useInstancesMock.mockImplementation(() => apiState);

    render(<InstanceDetailPage instanceId="demo" />);

    await openDoctor();

    fireEvent.click(screen.getByRole('button', { name: 'Vorbedingungen prüfen' }));

    await waitFor(() => {
      expect(apiState.refreshKeycloakPreflight).toHaveBeenCalledWith('demo');
      expect(screen.getByText('Vorbedingungen wurden aktualisiert.')).toBeTruthy();
    });

    apiState.mutationError = {
      status: 500,
      code: 'keycloak_unavailable',
      message: 'Status konnte nicht gelesen werden.',
    };

    fireEvent.click(screen.getAllByRole('button', { name: 'Keycloak-Status prüfen' })[0]);

    await waitFor(() => {
      expect(apiState.refreshKeycloakStatus).toHaveBeenCalledWith('demo');
    });
    expect(screen.queryByText('Vorbedingungen wurden aktualisiert.')).toBeNull();
  });

  it('polls the detail data automatically while provisioning steps are still running', async () => {
    vi.useFakeTimers();
    try {
      const loadInstance = vi.fn().mockResolvedValue(true);

      useInstancesMock.mockReturnValue(
        createInstancesApiState({
          loadInstance,
          selectedInstance: createSelectedInstance({
            realmMode: 'new',
            keycloakStatus: undefined,
            latestKeycloakProvisioningRun: {
              id: 'run-running',
              intent: 'provision',
              mode: 'new',
              overallStatus: 'running',
              driftSummary: 'Worker läuft noch.',
              requestId: 'req-running',
              steps: [],
            },
            keycloakProvisioningRuns: [],
          }),
        })
      );

      render(<InstanceDetailPage instanceId="demo" />);
      expect(loadInstance).toHaveBeenCalledWith('demo');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });

      expect(loadInstance).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not poll automatically when no provisioning step is running', async () => {
    vi.useFakeTimers();
    try {
      const loadInstance = vi.fn().mockResolvedValue(true);

      useInstancesMock.mockReturnValue(
        createInstancesApiState({
          loadInstance,
          selectedInstance: createSelectedInstance({
            latestKeycloakProvisioningRun: {
              id: 'run-complete',
              intent: 'provision',
              mode: 'existing',
              overallStatus: 'succeeded',
              driftSummary: 'Abgeschlossen.',
              requestId: 'req-complete',
              steps: [],
            },
          }),
        })
      );

      render(<InstanceDetailPage instanceId="demo" />);
      expect(loadInstance).toHaveBeenCalledWith('demo');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6_000);
      });
      expect(loadInstance).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the active tab during same-instance refreshes', async () => {
    const latestSelection = {
      current: createSelectedInstance({
        latestKeycloakProvisioningRun: {
          id: 'run-running',
          intent: 'provision',
          mode: 'new',
          overallStatus: 'running',
          driftSummary: 'Worker läuft noch.',
          requestId: 'req-running',
          steps: [],
        },
      }),
    };

    useInstancesMock.mockImplementation(() =>
      createInstancesApiState({
        selectedInstance: latestSelection.current,
      })
    );

    const view = render(<InstanceDetailPage instanceId="demo" />);

    await activateTab('Doctor');
    expect(screen.getByRole('tab', { name: 'Doctor' }).getAttribute('data-state')).toBe('active');

    latestSelection.current = createSelectedInstance({
      updatedAt: '2026-01-02T00:00:00.000Z',
      latestKeycloakProvisioningRun: {
        id: 'run-running',
        intent: 'provision',
        mode: 'new',
        overallStatus: 'running',
        driftSummary: 'Worker läuft noch immer.',
        requestId: 'req-running',
        steps: [],
      },
    });

    view.rerender(<InstanceDetailPage instanceId="demo" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Doctor' }).getAttribute('data-state')).toBe('active');
    });
  });

  it('surfaces a missing worker env blocker from the latest provisioning run', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          latestKeycloakProvisioningRun: {
            id: 'run-failed',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'failed',
            driftSummary: 'Provisioning wurde mit einem Fehler abgebrochen.',
            requestId: 'req-worker',
            steps: [
              {
                stepKey: 'worker_preflight_snapshot',
                title: 'Vorbedingungen prüfen',
                status: 'failed',
                summary: 'Die Vorbedingungen blockieren die Ausführung.',
                details: {
                  preflight: {
                    checks: [
                      {
                        checkKey: 'keycloak_admin_access',
                        status: 'blocked',
                        title: 'Technischer Keycloak-Zugriff',
                        summary: 'Der technische Keycloak-Admin-Client konnte den Ziel-Realm nicht lesen.',
                        details: {
                          error: 'Missing required env: KEYCLOAK_ADMIN_BASE_URL',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
          keycloakProvisioningRuns: [],
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(
      screen.getByText(
        'Der Provisioning-Worker kann Keycloak derzeit nicht technisch prüfen. Im laufenden Prozess fehlt KEYCLOAK_ADMIN_BASE_URL.'
      )
    ).toBeTruthy();
  });

  it('marks worker-pending projections as non-live keycloak evidence', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          keycloakPreflight: {
            overallStatus: 'warning',
            checkedAt: '2026-01-01T00:00:00.000Z',
            checks: [
              {
                checkKey: 'keycloak_admin_access',
                status: 'warning',
                title: 'Technischer Keycloak-Zugriff',
                summary: 'Die technische Prüfung wird durch den Provisioning-Worker durchgeführt und ist noch nicht gelaufen.',
                details: {
                  source: 'worker_pending',
                },
              },
            ],
          },
          keycloakPlan: {
            mode: 'existing',
            overallStatus: 'ready',
            generatedAt: '2026-01-01T00:00:00.000Z',
            driftSummary: 'Keycloak und Registry weisen Drift auf und werden beim nächsten Lauf abgeglichen.',
            steps: [],
          },
          latestKeycloakProvisioningRun: undefined,
          keycloakProvisioningRuns: [],
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(
      screen.getByText(
        'Die angezeigten Vorbedingungen und der Keycloak-Status sind derzeit nur eine Registry-basierte Vorabschätzung. Ein echter Live-Abgleich erfolgt erst im Provisioning-Worker.'
      )
    ).toBeTruthy();
  });

  it('renders non-keycloak mutation errors together with runtime diagnostics', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: {
          status: 409,
          code: 'conflict',
          message: 'conflict',
          classification: 'registry_or_provisioning_drift',
          recommendedAction: 'provisioning_pruefen',
          requestId: 'req-instance-9',
        },
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    const driftAlert = screen
      .getAllByRole('alert')
      .find((alert) =>
        alert.textContent?.includes(
          'Für diese Instanz liegt ein Registry- oder Provisioning-Drift vor. Bitte Keycloak-Status, Preflight und letzten Run gemeinsam prüfen.'
        )
      );

    expect(driftAlert?.textContent).toContain(
      'Für diese Instanz liegt ein Registry- oder Provisioning-Drift vor. Bitte Keycloak-Status, Preflight und letzten Run gemeinsam prüfen.'
    );
    expect(screen.getByText('Diagnose: Registry- oder Provisioning-Drift')).toBeTruthy();
    expect(screen.getByText('Empfohlene Aktion: Provisioning prüfen')).toBeTruthy();
    expect(screen.getAllByText('Request-ID: req-instance-9').length).toBeGreaterThan(0);
    expect(screen.getByText(/Vorbedingungen zuletzt geprüft: Status ready/i)).toBeTruthy();
    expect(screen.getByText('Letzte Provisioning-Vorschau: Kein Drift.')).toBeTruthy();
    expect(screen.getByText('Letzter Keycloak-Run: Request-ID req-1, Status succeeded')).toBeTruthy();
  });

  it('shows new-realm configuration as prepared, disables generated secrets, and avoids blocker lists', async () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          realmMode: 'new',
          authClientSecretConfigured: false,
          tenantAdminClient: {
            clientId: 'sva-studio-realm-admin',
            secretConfigured: false,
          },
          keycloakStatus: undefined,
          keycloakPreflight: undefined,
          keycloakPlan: undefined,
          latestKeycloakProvisioningRun: undefined,
          keycloakProvisioningRuns: [],
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    await openDoctor();
    expect(screen.getByRole('button', { name: 'Provisioning ausführen' })).toBeTruthy();

    await activateTab('Einstellungen');

    await waitFor(() => {
      expect(screen.getByText('Konfiguration vorbereitet')).toBeTruthy();
    });
    expect(screen.queryByText('Konkrete Blocker')).toBeNull();

    const tenantClientSecret = screen.getByLabelText('Tenant-Client-Secret', {
      selector: '#detail-auth-client-secret',
    }) as HTMLInputElement;
    expect(tenantClientSecret.disabled).toBe(true);
    expect(tenantClientSecret.placeholder).toBe('Wird beim Provisioning automatisch erzeugt');
    expect(
      screen.getAllByText('Bei neuen Realms wird das Secret beim Provisioning automatisch erzeugt und danach in Studio gespeichert.')
    ).toHaveLength(2);

    const tenantAdminClientSecret = screen.getByLabelText('Tenant-Admin-Client-Secret', {
      selector: '#detail-tenant-admin-client-secret',
    }) as HTMLInputElement;
    expect(tenantAdminClientSecret.disabled).toBe(true);
    expect(tenantAdminClientSecret.placeholder).toBe('Wird beim Provisioning automatisch erzeugt');
  });

  it('renders follow-up module actions separately and loads runs from the history tab on demand', async () => {
    const seedIamBaseline = vi.fn().mockResolvedValue(true);
    const loadKeycloakProvisioningRun = vi.fn().mockResolvedValue(true);
    const assignModule = vi.fn().mockResolvedValue(true);
    const bootstrapAdminStructure = vi.fn().mockResolvedValue(true);

    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        seedIamBaseline,
        loadKeycloakProvisioningRun,
        assignModule,
        bootstrapAdminStructure,
        selectedInstance: createSelectedInstance({
          assignedModules: ['news'],
          latestKeycloakProvisioningRun: {
            id: 'run-current',
            intent: 'provision',
            mode: 'existing',
            overallStatus: 'succeeded',
            driftSummary: 'Aktueller Run erfolgreich.',
            requestId: 'req-current',
            steps: [],
          },
          keycloakProvisioningRuns: [
            {
              id: 'run-history-1',
              intent: 'reset_tenant_admin',
              mode: 'existing',
              overallStatus: 'failed',
              driftSummary: 'Historischer Fehler',
              requestId: null,
              steps: [
                {
                  stepKey: 'cleanup',
                  title: 'Aufräumen',
                  status: 'failed',
                  summary: 'Abgebrochen',
                },
              ],
            },
          ],
          moduleIamStatus: {
            overall: { status: 'degraded', summary: 'IAM-Basis unvollständig', source: 'registry' },
            modules: [
              {
                moduleId: 'news',
                status: 'blocked',
                summary: 'Berechtigungen fehlen',
                permissionIds: [],
              },
            ],
          },
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    await activateTab('Betrieb');
    expect(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' })).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tenant-Admin-Struktur initialisieren' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Modul zuweisen' })[0]!);

    expect(seedIamBaseline).toHaveBeenCalledWith('demo');
    expect(assignModule).toHaveBeenCalledWith('demo', 'events');
    expect(bootstrapAdminStructure).not.toHaveBeenCalled();

    await activateTab('Doctor');
    expect(screen.getByText('Historischer Fehler')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Run laden' })[1]);

    await waitFor(() => {
      expect(loadKeycloakProvisioningRun).toHaveBeenCalledWith('demo', 'run-history-1');
    });
  });

  it('renders a loading shell when no matching instance detail is selected', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          instanceId: 'other-instance',
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(screen.getByText('Inhalte werden geladen ...')).toBeTruthy();
    expect(screen.queryByText('Überblick')).toBeNull();
  });
});
