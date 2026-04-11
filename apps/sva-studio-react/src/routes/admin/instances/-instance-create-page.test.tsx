import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstanceCreatePage } from './-instance-create-page';

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

const createCreatedInstance = (overrides: Record<string, unknown> = {}) => ({
  instanceId: 'demo',
  displayName: 'Demo',
  status: 'requested',
  parentDomain: 'studio.example.org',
  primaryHostname: 'demo.studio.example.org',
  realmMode: 'existing',
  authRealm: 'demo',
  authClientId: 'sva-studio',
  authIssuerUrl: undefined,
  authClientSecretConfigured: false,
  hostnames: [],
  ...overrides,
});

const createInstancesApiState = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
  selectedInstance: null,
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
  createInstance: vi.fn().mockResolvedValue(createCreatedInstance()),
  updateInstance: vi.fn().mockResolvedValue(true),
  refreshKeycloakStatus: vi.fn().mockResolvedValue(true),
  reconcileKeycloak: vi.fn().mockResolvedValue(true),
  activateInstance: vi.fn().mockResolvedValue(true),
  suspendInstance: vi.fn().mockResolvedValue(true),
  archiveInstance: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('InstanceCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useInstancesMock.mockReset();
  });

  it('guides through the wizard and shows the next steps after creation', async () => {
    const createInstance = vi.fn().mockResolvedValue(
      createCreatedInstance({
        instanceId: 'demo',
        authRealm: 'saas-demo',
      })
    );
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance }));
    window.history.replaceState({}, '', '/admin/instances/new');

    render(<InstanceCreatePage />);

    const parentDomainInput = screen.getByLabelText('Parent-Domain', { selector: '#instance-parent-domain' }) as HTMLInputElement;
    expect(parentDomainInput.value).toBe('localhost');
    expect(parentDomainInput.placeholder).toBe('localhost');
    expect(screen.getByText('Bestehender Realm: Der Provisioning-Lauf erwartet den Realm bereits in Keycloak und zeigt Drift an.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Instanz-ID', { selector: '#instance-id' }), { target: { value: ' demo ' } });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
      target: { value: ' Demo ' },
    });
    fireEvent.change(parentDomainInput, { target: { value: ' studio.example.org ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(screen.getByText('Keycloak-Zuordnung')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#instance-auth-realm' }), {
      target: { value: ' saas-demo ' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#instance-auth-client-id' }), {
      target: { value: ' tenant-client ' },
    });
    fireEvent.change(screen.getByLabelText('Tenant-Client-Secret', { selector: '#instance-auth-client-secret' }), {
      target: { value: ' test-client-secret ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(screen.getByText('Tenant-Admin')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Admin-Benutzername', { selector: '#instance-admin-username' }), {
      target: { value: ' setup-admin ' },
    });
    fireEvent.change(screen.getByLabelText('Admin-E-Mail', { selector: '#instance-admin-email' }), {
      target: { value: ' admin@example.org ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(screen.getByText('Eingaben prüfen')).toBeTruthy();
    expect(screen.getByText('Bestehender Realm')).toBeTruthy();
    expect(screen.getByText('Ein Secret wird mit der Instanz gespeichert und kann im Provisioning direkt geprüft werden.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(createInstance).toHaveBeenCalledWith({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'saas-demo',
        authClientId: 'tenant-client',
        authIssuerUrl: undefined,
        authClientSecret: 'test-client-secret',
        tenantAdminBootstrap: {
          username: 'setup-admin',
          email: 'admin@example.org',
          firstName: undefined,
          lastName: undefined,
        },
      });
    });

    expect(screen.getByText('Instanz gespeichert')).toBeTruthy();
    expect(screen.getByText('Die Instanz demo wurde in der Registry angelegt. Aktueller Status: Angefordert.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Detailseite öffnen' }).getAttribute('href')).toBe('/admin/instances/demo');
    expect(screen.getByText('Führen Sie dort den Keycloak-Abgleich für Realm saas-demo aus.')).toBeTruthy();
  });

  it('shows step validation before moving on', () => {
    useInstancesMock.mockReturnValue(createInstancesApiState());

    render(<InstanceCreatePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(screen.getByRole('alert').textContent).toContain('Bitte eine Instanz-ID angeben.');
    expect(screen.getByRole('alert').textContent).toContain('Bitte einen Anzeigenamen angeben.');
    expect(screen.getByRole('alert').textContent).not.toContain('Bitte eine Parent-Domain angeben.');
  });

  it('does not require a tenant secret for new realms and explains generation during provisioning', async () => {
    const createInstance = vi.fn().mockResolvedValue(
      createCreatedInstance({
        instanceId: 'demo-new',
        realmMode: 'new',
        authRealm: 'saas-demo-new',
        authClientSecretConfigured: false,
      })
    );
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance }));

    render(<InstanceCreatePage />);

    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.change(screen.getByLabelText('Instanz-ID', { selector: '#instance-id' }), { target: { value: 'demo-new' } });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
      target: { value: 'Demo New' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const secretInput = screen.getByLabelText('Tenant-Client-Secret', {
      selector: '#instance-auth-client-secret',
    }) as HTMLInputElement;
    expect(secretInput.disabled).toBe(true);
    expect(secretInput.placeholder).toBe('Wird beim Provisioning automatisch erzeugt');
    expect(
      screen.getByText(
        'Für neue Realms müssen Sie hier kein Secret kennen. Studio erzeugt es beim Provisioning und speichert es anschließend.'
      )
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#instance-auth-realm' }), {
      target: { value: 'saas-demo-new' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#instance-auth-client-id' }), {
      target: { value: 'sva-studio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(
      screen.getByText('Bei einem neuen Realm wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(createInstance).toHaveBeenCalledWith({
        instanceId: 'demo-new',
        displayName: 'Demo New',
        parentDomain: 'localhost',
        realmMode: 'new',
        authRealm: 'saas-demo-new',
        authClientId: 'sva-studio',
        authIssuerUrl: undefined,
        authClientSecret: undefined,
        tenantAdminBootstrap: undefined,
      });
    });
  });

  it('renders mutation errors', () => {
    useInstancesMock.mockReturnValue(
      createInstancesApiState({
        mutationError: { status: 503, code: 'encryption_not_configured', message: 'kaputt' },
      })
    );

    render(<InstanceCreatePage />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Die notwendige Feldverschlüsselung für Tenant-Secrets ist nicht konfiguriert.'
    );
  });
});
