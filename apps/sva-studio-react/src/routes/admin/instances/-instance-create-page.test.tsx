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
  realmMode: 'new',
  authRealm: 'demo',
  authClientId: 'sva-studio-login',
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
  bootstrapAdminStructure: vi.fn().mockResolvedValue({
    instanceId: 'demo',
    displayName: 'Demo',
    status: 'requested',
    parentDomain: 'studio.example.org',
    primaryHostname: 'demo.studio.example.org',
    hostnames: [],
    provisioningRuns: [],
    keycloakProvisioningRuns: [],
    auditEvents: [],
    assignedModules: [],
  }),
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
    expect((screen.getByRole('radio', { name: /Neuer Realm:/u }) as HTMLInputElement).checked).toBe(true);
    expect(
      screen.getByText('Neuer Realm: Der Provisioning-Lauf legt den Realm an und blockiert, wenn er bereits existiert.')
    ).toBeTruthy();

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
    const authClientSecretInput = screen.getByLabelText('Tenant-Client-Secret', {
      selector: '#instance-auth-client-secret',
    }) as HTMLInputElement;
    expect(authClientSecretInput.disabled).toBe(true);
    const tenantAdminClientIdInput = screen.getByLabelText('Tenant-Admin-Client-ID', {
      selector: '#instance-tenant-admin-client-id',
    }) as HTMLInputElement;
    expect(tenantAdminClientIdInput.value).toBe('sva-studio-realm-admin');
    fireEvent.change(tenantAdminClientIdInput, { target: { value: ' sva-studio-realm-admin ' } });
    const tenantAdminSecretInput = screen.getByLabelText('Tenant-Admin-Client-Secret', {
      selector: '#instance-tenant-admin-client-secret',
    }) as HTMLInputElement;
    expect(tenantAdminSecretInput.disabled).toBe(true);
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
    expect(screen.getByText('Neuer Realm')).toBeTruthy();
    expect(screen.getByText('Bei einem neuen Realm wird das Tenant-Client-Secret erst beim Provisioning erzeugt und danach gespeichert.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(createInstance).toHaveBeenCalledWith({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'studio.example.org',
        realmMode: 'new',
        authRealm: 'saas-demo',
        authClientId: 'tenant-client',
        authIssuerUrl: undefined,
        authClientSecret: undefined,
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secret: undefined,
        },
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
    expect(screen.getByText('Admin-Struktur')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' })).toBeTruthy();
  });

  it('runs the admin bootstrap step after a successful create', async () => {
    const createInstance = vi.fn().mockResolvedValue(
      createCreatedInstance({
        instanceId: 'demo',
        authRealm: 'saas-demo',
      })
    );
    const bootstrapAdminStructure = vi.fn().mockResolvedValue({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      hostnames: [],
      provisioningRuns: [],
      keycloakProvisioningRuns: [],
      auditEvents: [],
      assignedModules: [],
    });
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance, bootstrapAdminStructure }));

    render(<InstanceCreatePage />);

    fireEvent.change(screen.getByLabelText('Instanz-ID', { selector: '#instance-id' }), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
      target: { value: 'Demo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#instance-auth-realm' }), {
      target: { value: 'saas-demo' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#instance-auth-client-id' }), {
      target: { value: 'tenant-client' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' })).toBeTruthy();
    });

    const newsCheckbox = screen.getByRole('checkbox', { name: /News/u });
    expect(newsCheckbox).toBeTruthy();
    expect(newsCheckbox.closest('label')?.getAttribute('aria-labelledby')).toBe(
      'instance-admin-bootstrap-module-news-title'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' }));

    await waitFor(() => {
      expect(bootstrapAdminStructure).toHaveBeenCalledWith('demo', []);
    });
  });

  it('passes selected modules to the admin bootstrap and clears the finished state after form edits', async () => {
    const createInstance = vi.fn().mockResolvedValue(
      createCreatedInstance({
        instanceId: 'demo',
        authRealm: 'saas-demo',
      })
    );
    const bootstrapAdminStructure = vi.fn().mockResolvedValue({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      hostnames: [],
      provisioningRuns: [],
      keycloakProvisioningRuns: [],
      auditEvents: [],
      assignedModules: [
        { moduleId: 'news', assignedAt: '2026-05-07T16:00:00.000Z' },
        { moduleId: 'events', assignedAt: '2026-05-07T16:00:00.000Z' },
      ],
    });
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance, bootstrapAdminStructure }));

    render(<InstanceCreatePage />);

    fireEvent.change(screen.getByLabelText('Instanz-ID', { selector: '#instance-id' }), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
      target: { value: 'Demo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#instance-auth-realm' }), {
      target: { value: 'saas-demo' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#instance-auth-client-id' }), {
      target: { value: 'tenant-client' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/news\.read/));
    fireEvent.click(screen.getByText(/events\.read/));
    fireEvent.click(screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' }));

    await waitFor(() => {
      expect(bootstrapAdminStructure).toHaveBeenCalledWith('demo', ['news', 'events']);
    });

    expect(
      screen.getByText('Die initiale Admin-Struktur wurde erfolgreich angelegt. Die Instanz gilt damit im Create-Flow als fertig.')
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Basisdaten/u }));
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
      target: { value: 'Demo aktualisiert' },
    });

    expect(
      screen.queryByText('Die initiale Admin-Struktur wurde erfolgreich angelegt. Die Instanz gilt damit im Create-Flow als fertig.')
    ).toBeNull();
    expect((screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the bootstrap mutation error after create when the admin structure step fails', async () => {
    const createInstance = vi.fn().mockResolvedValue(
      createCreatedInstance({
        instanceId: 'demo',
        authRealm: 'saas-demo',
      })
    );
    const instancesApiState = createInstancesApiState() as ReturnType<typeof createInstancesApiState> & {
      mutationError: { status: number; code: string; message: string } | null;
    };
    const mutableInstancesApiState = instancesApiState as { mutationError: { status: number; code: string; message: string } | null };
    const bootstrapAdminStructure = vi.fn().mockImplementation(async () => {
      mutableInstancesApiState.mutationError = { status: 409, code: 'conflict', message: 'bootstrap fehlgeschlagen' };
      return null;
    });
    instancesApiState.createInstance = createInstance;
    instancesApiState.bootstrapAdminStructure = bootstrapAdminStructure;
    useInstancesMock.mockImplementation(() => instancesApiState);

    render(<InstanceCreatePage />);

    fireEvent.change(screen.getByLabelText('Instanz-ID', { selector: '#instance-id' }), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
      target: { value: 'Demo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#instance-auth-realm' }), {
      target: { value: 'saas-demo' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#instance-auth-client-id' }), {
      target: { value: 'tenant-client' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Admin-Struktur jetzt anlegen' }));

    await waitFor(() => {
      expect(bootstrapAdminStructure).toHaveBeenCalledWith('demo', []);
    });

    expect(screen.getByText('Die gewünschte Änderung steht im Konflikt mit dem aktuellen Instanzstatus.')).toBeTruthy();
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
    const tenantAdminSecretInput = screen.getByLabelText('Tenant-Admin-Client-Secret', {
      selector: '#instance-tenant-admin-client-secret',
    }) as HTMLInputElement;
    const tenantAdminClientIdInput = screen.getByLabelText('Tenant-Admin-Client-ID', {
      selector: '#instance-tenant-admin-client-id',
    }) as HTMLInputElement;
    expect(secretInput.disabled).toBe(true);
    expect(tenantAdminSecretInput.disabled).toBe(true);
    expect(tenantAdminClientIdInput.value).toBe('sva-studio-realm-admin');
    expect(secretInput.placeholder).toBe('Wird beim Provisioning automatisch erzeugt');
    expect(tenantAdminSecretInput.placeholder).toBe('Wird beim Provisioning automatisch erzeugt');
    expect(
      screen.getByText(
        'Für neue Realms müssen Sie hier kein Secret kennen. Studio erzeugt es beim Provisioning und speichert es anschließend.'
      )
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#instance-auth-realm' }), {
      target: { value: 'saas-demo-new' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#instance-auth-client-id' }), {
      target: { value: 'sva-studio-login' },
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
        authClientId: 'sva-studio-login',
        authIssuerUrl: undefined,
        authClientSecret: undefined,
        tenantAdminClient: {
          clientId: 'sva-studio-realm-admin',
          secret: undefined,
        },
        tenantAdminBootstrap: undefined,
      });
    });
  });

  it('requires secrets for existing realms and submits the optional issuer and tenant-admin fields', async () => {
    const createInstance = vi.fn().mockResolvedValue(
      createCreatedInstance({
        instanceId: 'demo-existing',
        realmMode: 'existing',
        authRealm: 'tenant-existing',
        authClientSecretConfigured: true,
      })
    );
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance }));

    render(<InstanceCreatePage />);

    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.change(screen.getByLabelText('Instanz-ID', { selector: '#instance-id' }), {
      target: { value: 'demo-existing' },
    });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
      target: { value: 'Demo Existing' },
    });
    fireEvent.change(screen.getByLabelText('Parent-Domain', { selector: '#instance-parent-domain' }), {
      target: { value: 'studio.example.org' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const authClientSecretInput = screen.getByLabelText('Tenant-Client-Secret', {
      selector: '#instance-auth-client-secret',
    }) as HTMLInputElement;
    const tenantAdminSecretInput = screen.getByLabelText('Tenant-Admin-Client-Secret', {
      selector: '#instance-tenant-admin-client-secret',
    }) as HTMLInputElement;
    expect(authClientSecretInput.disabled).toBe(false);
    expect(tenantAdminSecretInput.disabled).toBe(false);
    expect(
      screen.getByText(
        'Das Tenant-Client-Secret ist für bestehende Realms stark empfohlen, damit Status- und Drift-Prüfungen vollständig laufen.'
      )
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Auth-Realm', { selector: '#instance-auth-realm' }), {
      target: { value: 'tenant-existing' },
    });
    fireEvent.change(screen.getByLabelText('Auth-Client-ID', { selector: '#instance-auth-client-id' }), {
      target: { value: 'tenant-client' },
    });
    fireEvent.change(authClientSecretInput, { target: { value: ' tenant-secret ' } });
    fireEvent.change(screen.getByLabelText('Tenant-Admin-Client-ID', { selector: '#instance-tenant-admin-client-id' }), {
      target: { value: ' tenant-admin-client ' },
    });
    fireEvent.change(tenantAdminSecretInput, { target: { value: ' tenant-admin-secret ' } });
    fireEvent.change(screen.getByLabelText('Auth-Issuer-URL', { selector: '#instance-auth-issuer-url' }), {
      target: { value: ' https://auth.example.org/realms/tenant-existing ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    fireEvent.change(screen.getByLabelText('Admin-Benutzername', { selector: '#instance-admin-username' }), {
      target: { value: ' tenant-admin ' },
    });
    fireEvent.change(screen.getByLabelText('Admin-E-Mail', { selector: '#instance-admin-email' }), {
      target: { value: ' tenant-admin@example.org ' },
    });
    fireEvent.change(screen.getByLabelText('Admin-Vorname', { selector: '#instance-admin-first-name' }), {
      target: { value: ' Tina ' },
    });
    fireEvent.change(screen.getByLabelText('Admin-Nachname', { selector: '#instance-admin-last-name' }), {
      target: { value: ' Admin ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    expect(screen.getByText('Bestehender Realm')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Instanz anlegen' }));

    await waitFor(() => {
      expect(createInstance).toHaveBeenCalledWith({
        instanceId: 'demo-existing',
        displayName: 'Demo Existing',
        parentDomain: 'studio.example.org',
        realmMode: 'existing',
        authRealm: 'tenant-existing',
        authClientId: 'tenant-client',
        authIssuerUrl: 'https://auth.example.org/realms/tenant-existing',
        authClientSecret: 'tenant-secret',
        tenantAdminClient: {
          clientId: 'tenant-admin-client',
          secret: 'tenant-admin-secret',
        },
        tenantAdminBootstrap: {
          username: 'tenant-admin',
          email: 'tenant-admin@example.org',
          firstName: 'Tina',
          lastName: 'Admin',
        },
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
