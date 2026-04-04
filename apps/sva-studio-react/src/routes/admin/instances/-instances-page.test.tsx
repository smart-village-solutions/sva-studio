import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
        authRealm: 'demo',
        authClientId: 'sva-studio',
      });
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Instanz-ID') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Anzeigename') as HTMLInputElement).value).toBe('');
      expect((screen.getByLabelText('Parent-Domain') as HTMLInputElement).value).toBe('studio.example.org');
    });
  });

  it('prefills the parent-domain field from runtime config', () => {
    useInstancesMock.mockReturnValue(createInstancesApiState());
    window.history.replaceState({}, '', '/admin/instances');

    render(<InstancesPage />);

    const input = screen.getByLabelText('Parent-Domain') as HTMLInputElement;
    expect(input.value).toBe('localhost');
    expect(input.placeholder).toBe('localhost');
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
    const [accessAlert, conflictAlert] = alerts;
    if (!accessAlert || !conflictAlert) {
      throw new Error('Zwei Alerts erwartet.');
    }
    expect(within(accessAlert).getByText('Keine Berechtigung für die Instanzverwaltung.')).toBeTruthy();
    expect(within(conflictAlert).getByText('Die gewünschte Änderung steht im Konflikt mit dem aktuellen Instanzstatus.')).toBeTruthy();
    expect(screen.getByText('Primärer Hostname: demo.studio.example.org')).toBeTruthy();
    expect(screen.getByText('Parent-Domain: studio.example.org')).toBeTruthy();
    expect(screen.getByText('Status: Suspendiert')).toBeTruthy();
    expect(screen.getByText('activate')).toBeTruthy();
    expect(screen.getByText('Laufstatus: Aktiv')).toBeTruthy();
  });

  it('updates selected instance settings, clears write-only secrets, and runs keycloak actions', async () => {
    const updateInstance = vi.fn().mockResolvedValue(true);
    const refreshKeycloakStatus = vi.fn().mockResolvedValue(true);
    const reconcileKeycloak = vi.fn().mockResolvedValue(true);
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        updateInstance,
        refreshKeycloakStatus,
        reconcileKeycloak,
        selectedInstance: {
          instanceId: 'demo',
          displayName: 'Demo',
          status: 'active',
          parentDomain: 'studio.example.org',
          primaryHostname: 'demo.studio.example.org',
          authRealm: 'demo',
          authClientId: 'sva-studio',
          authClientSecretConfigured: true,
          hostnames: [],
          provisioningRuns: [],
          auditEvents: [],
          tenantAdminBootstrap: {
            username: 'demo-admin',
            email: 'demo@example.org',
            firstName: 'Demo',
            lastName: 'Admin',
          },
          keycloakStatus: {
            realmExists: true,
            clientExists: true,
            instanceIdMapperExists: true,
            tenantAdminExists: true,
            tenantAdminHasSystemAdmin: true,
            tenantAdminHasInstanceRegistryAdmin: false,
            redirectUrisMatch: true,
            logoutUrisMatch: true,
            webOriginsMatch: true,
            clientSecretConfigured: true,
            tenantClientSecretReadable: true,
            clientSecretAligned: true,
            runtimeSecretSource: 'tenant',
          },
        },
      })
    );

    render(<InstancesPage />);

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
    fireEvent.change(screen.getByLabelText('Admin-Benutzername', { selector: '#detail-admin-username' }), {
      target: { value: ' updated-admin ' },
    });
    fireEvent.change(screen.getByLabelText('Temporäres Admin-Passwort'), {
      target: { value: ' test-temp-password ' },
    });
    fireEvent.click(screen.getByLabelText('Tenant-Client-Secret beim Reconcile erneut in Keycloak setzen'));
    fireEvent.click(screen.getByRole('button', { name: 'Instanz speichern' }));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledWith('demo', {
        displayName: 'Demo Updated',
        parentDomain: 'studio.example.org',
        authRealm: 'demo-updated',
        authClientId: 'tenant-client',
        authIssuerUrl: 'https://issuer.example.org',
        authClientSecret: 'test-client-secret',
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
    });

    fireEvent.click(screen.getByRole('button', { name: 'Keycloak-Status prüfen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Realm anwenden' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tenant-Admin neu setzen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Client-Secret rotieren' }));

    expect(refreshKeycloakStatus).toHaveBeenCalledWith('demo');
    await waitFor(() => {
      expect(reconcileKeycloak).toHaveBeenNthCalledWith(1, 'demo', {
        rotateClientSecret: false,
        tenantAdminTemporaryPassword: 'test-temp-password',
      });
      expect(reconcileKeycloak).toHaveBeenNthCalledWith(2, 'demo', {
        rotateClientSecret: false,
        tenantAdminTemporaryPassword: 'test-temp-password',
      });
      expect(reconcileKeycloak).toHaveBeenNthCalledWith(3, 'demo', {
        rotateClientSecret: true,
        tenantAdminTemporaryPassword: 'test-temp-password',
      });
    });

    await waitFor(() => {
      expect((screen.getByLabelText('Temporäres Admin-Passwort') as HTMLInputElement).value).toBe('');
      expect(
        (screen.getByLabelText('Tenant-Client-Secret beim Reconcile erneut in Keycloak setzen') as HTMLInputElement).checked
      ).toBe(false);
    });
    expect(screen.getByText('Runtime nutzt Tenant-Secret')).toBeTruthy();
  });

  it('maps additional keycloak and encryption error states', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: { status: 503, code: 'encryption_not_configured', message: 'kaputt' },
      })
    );

    render(<InstancesPage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Die notwendige Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.'
    );
  });
});
