import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '../../../i18n';
import { InstanceDetailPage } from './-instance-detail-page';

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

const createSelectedInstance = (overrides: Record<string, unknown> = {}) => ({
  instanceId: 'demo',
  displayName: 'Demo',
  status: 'requested',
  parentDomain: 'studio.example.org',
  primaryHostname: 'demo.studio.example.org',
  realmMode: 'existing',
  authRealm: 'demo',
  authClientId: 'sva-studio',
  authClientSecretConfigured: true,
  tenantAdminClient: {
    clientId: 'sva-studio-admin',
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
    instanceIdMapperExists: true,
    tenantAdminExists: true,
    tenantAdminHasSystemAdmin: true,
    tenantAdminHasInstanceRegistryAdmin: false,
    tenantAdminInstanceIdMatches: true,
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
  reconcileKeycloak: vi.fn().mockResolvedValue(true),
  activateInstance: vi.fn().mockResolvedValue(true),
  suspendInstance: vi.fn().mockResolvedValue(true),
  archiveInstance: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('InstanceDetailPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
  });

  it('loads the instance detail, shows workflow guidance, and executes actions', async () => {
    const loadInstance = vi.fn().mockResolvedValue(true);
    const updateInstance = vi.fn().mockResolvedValue(true);
    const refreshKeycloakPreflight = vi.fn().mockResolvedValue(true);
    const planKeycloakProvisioning = vi.fn().mockResolvedValue(true);
    const refreshKeycloakStatus = vi.fn().mockResolvedValue(true);
    const executeKeycloakProvisioning = vi.fn().mockResolvedValue(true);
    const activateInstance = vi.fn().mockResolvedValue(true);

    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        loadInstance,
        updateInstance,
        refreshKeycloakPreflight,
        planKeycloakProvisioning,
        refreshKeycloakStatus,
        executeKeycloakProvisioning,
        activateInstance,
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    await waitFor(() => {
      expect(loadInstance).toHaveBeenCalledWith('demo');
    });

    expect(screen.getByText(t('admin.instances.configuration.title'))).toBeTruthy();
    expect(screen.getByText(t('admin.instances.configuration.summary.complete.title'))).toBeTruthy();
    expect(
      screen.getByText(
        t('admin.instances.configuration.labels.requirementsValue', {
          satisfied: 13,
          total: 13,
        })
      )
    ).toBeTruthy();
    expect(screen.getByText('Instanz gespeichert, aber noch nicht betriebsbereit')).toBeTruthy();
    expect(screen.getByText('Was ist noch offen?')).toBeTruthy();
    expect(screen.getByText('Provisioning ist erfolgreich. Die Instanz kann jetzt aktiviert werden.')).toBeTruthy();
    expect(screen.getByText('Runtime nutzt Tenant-Secret')).toBeTruthy();

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
    fireEvent.change(screen.getByLabelText('Temporäres Admin-Passwort'), {
      target: { value: ' test-temp-password ' },
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Vorbedingungen prüfen' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Keycloak-Status prüfen' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Provisioning-Vorschau laden' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Provisioning ausführen' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tenant-Admin-Client bereitstellen' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tenant-Admin neu setzen' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Client-Secret rotieren' }).at(-1)!);
    fireEvent.click(screen.getByRole('button', { name: 'Aktivieren' }));

    expect(refreshKeycloakPreflight).toHaveBeenCalledWith('demo');
    expect(planKeycloakProvisioning).toHaveBeenCalledWith('demo');
    expect(refreshKeycloakStatus).toHaveBeenCalledWith('demo');
    expect(activateInstance).toHaveBeenCalledWith('demo');
    await waitFor(() => {
      expect(executeKeycloakProvisioning.mock.calls).toEqual(
        expect.arrayContaining([
          [
            'demo',
            {
              intent: 'provision',
              tenantAdminTemporaryPassword: 'test-temp-password',
            },
          ],
          [
            'demo',
            {
              intent: 'provision_admin_client',
              tenantAdminTemporaryPassword: 'test-temp-password',
            },
          ],
          [
            'demo',
            {
              intent: 'reset_tenant_admin',
              tenantAdminTemporaryPassword: 'test-temp-password',
            },
          ],
          [
            'demo',
            {
              intent: 'rotate_client_secret',
              tenantAdminTemporaryPassword: 'test-temp-password',
            },
          ],
        ])
      );
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Temporäres Admin-Passwort') as HTMLInputElement).value).toBe('');
    });
  });

  it('keeps the detail page usable when keycloak is unavailable', async () => {
    const refreshKeycloakPreflight = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: { status: 502, code: 'keycloak_unavailable', message: 'kaputt' },
        selectedInstance: createSelectedInstance({
          keycloakStatus: undefined,
          latestKeycloakProvisioningRun: undefined,
          keycloakProvisioningRuns: [],
        }),
        refreshKeycloakPreflight,
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(screen.getByText('Die Detailseite bleibt bedienbar, aber Keycloak-Aktionen und Prüfungen sind aktuell blockiert. Prüfen Sie Erreichbarkeit und Credentials.')).toBeTruthy();
    expect(screen.getByText('Technischer Keycloak-Zugriff')).toBeTruthy();
    expect(screen.queryByText('Keycloak konnte nicht erreicht oder nicht abgeglichen werden.')).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Vorbedingungen prüfen' })[0]);

    await waitFor(() => {
      expect(refreshKeycloakPreflight).toHaveBeenCalledWith('demo');
    });
  });

  it('keeps the tenant secret field read-only for new realms and marks generation as pending', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          realmMode: 'new',
          authClientSecretConfigured: false,
          keycloakStatus: {
            realmExists: false,
            clientExists: false,
            tenantAdminClientExists: false,
            instanceIdMapperExists: false,
            tenantAdminExists: false,
            tenantAdminHasSystemAdmin: false,
            tenantAdminHasInstanceRegistryAdmin: false,
            tenantAdminInstanceIdMatches: false,
            redirectUrisMatch: false,
            logoutUrisMatch: false,
            webOriginsMatch: false,
            clientSecretConfigured: false,
            tenantClientSecretReadable: false,
            clientSecretAligned: false,
            tenantAdminClientSecretConfigured: false,
            tenantAdminClientSecretReadable: false,
            tenantAdminClientSecretAligned: false,
            runtimeSecretSource: 'global',
          },
          latestKeycloakProvisioningRun: undefined,
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    const secretInput = screen.getByLabelText('Tenant-Client-Secret', {
      selector: '#detail-auth-client-secret',
    }) as HTMLInputElement;
    expect(secretInput.disabled).toBe(true);
    expect(secretInput.placeholder).toBe('Wird beim Provisioning automatisch erzeugt');
    expect(screen.getByText('Für neue Realms wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.')).toBeTruthy();
    expect(
      screen.getByText('Bei neuen Realms wird das Secret beim Provisioning automatisch erzeugt und danach in Studio gespeichert.')
    ).toBeTruthy();
  });

  it('shows blocking configuration issues when the tenant admin client contract is incomplete', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        selectedInstance: createSelectedInstance({
          status: 'active',
          tenantAdminClient: {
            clientId: 'demo-admin-client',
            secretConfigured: false,
          },
          keycloakStatus: {
            realmExists: true,
            clientExists: true,
            tenantAdminClientExists: false,
            instanceIdMapperExists: true,
            tenantAdminExists: true,
            tenantAdminHasSystemAdmin: true,
            tenantAdminHasInstanceRegistryAdmin: false,
            tenantAdminInstanceIdMatches: true,
            redirectUrisMatch: true,
            logoutUrisMatch: true,
            webOriginsMatch: true,
            clientSecretConfigured: true,
            tenantClientSecretReadable: true,
            clientSecretAligned: true,
            tenantAdminClientSecretConfigured: false,
            tenantAdminClientSecretReadable: false,
            tenantAdminClientSecretAligned: false,
            runtimeSecretSource: 'tenant',
          },
        }),
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(screen.getByText('Konfiguration unvollständig')).toBeTruthy();
    expect(screen.getByText('Konkrete Blocker')).toBeTruthy();
    expect(screen.getByText('Tenant-Admin-Client vorhanden')).toBeTruthy();
    expect(screen.getByText('Tenant-Admin-Client-Secret mit Keycloak abgeglichen')).toBeTruthy();
  });

  it('renders non-keycloak mutation errors', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: { status: 409, code: 'conflict', message: 'conflict' },
      })
    );

    render(<InstanceDetailPage instanceId="demo" />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Die gewünschte Änderung steht im Konflikt mit dem aktuellen Instanzstatus.'
    );
  });
});
