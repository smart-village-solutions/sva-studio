import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const createInstancesApiState = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
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

describe('InstanceDetailPage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
  });

  it('loads the instance detail and updates keycloak-related actions', async () => {
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

    expect(screen.getByText('Primärer Hostname: demo.studio.example.org')).toBeTruthy();
    expect(screen.getByText('Status: Aktiv')).toBeTruthy();

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

  it('renders mutation errors', () => {
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
