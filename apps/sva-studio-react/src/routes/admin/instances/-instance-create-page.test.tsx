import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstanceCreatePage } from './-instance-create-page';

const useInstancesMock = vi.fn();
const navigateMock = vi.fn();
const getDraftReadinessMock = vi.fn();
const listRealmCatalogMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-instances', () => ({
  useInstances: () => useInstancesMock(),
}));

vi.mock('../../../lib/iam-api', () => ({
  asIamError: (error: unknown) => error,
  getInstanceDraftReadiness: (...args: unknown[]) => getDraftReadinessMock(...args),
  listInstanceRealmCatalog: (...args: unknown[]) => listRealmCatalogMock(...args),
}));

const readyDraft = {
  checkedAt: '2026-09-20T12:00:00.000Z',
  contractVersion: '1.0',
  draftFingerprint: 'a'.repeat(64),
  normalizedDraft: {
    instanceId: 'demo',
    primaryHostname: 'demo.dialog.kassel.de',
    realmMode: 'new',
    authRealm: 'demo',
    authClientId: 'sva-studio-login',
    authClientSecretConfigured: false,
  },
  createBlockers: [],
  provisioningBlockers: [],
  activationBlockers: [],
  backgroundCapabilities: [],
  preflight: { overallStatus: 'ready', checkedAt: '2026-09-20T12:00:00.000Z', checks: [] },
};

const createInstancesApiState = (overrides: Record<string, unknown> = {}) => ({
  instances: [],
  selectedInstance: null,
  isLoading: false,
  detailLoading: false,
  statusLoading: false,
  error: null,
  mutationError: null,
  createInstance: vi.fn().mockResolvedValue({ instanceId: 'demo' }),
  ...overrides,
});

const fillBasics = (instanceId = 'demo') => {
  fireEvent.change(screen.getByLabelText('Instanz-ID', { selector: '#instance-id' }), {
    target: { value: instanceId },
  });
  fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#instance-display-name' }), {
    target: { value: 'Demo' },
  });
};

const fillAdministrator = () => {
  fireEvent.change(
    screen.getByLabelText('Admin-Benutzername', { selector: '#instance-admin-username' }),
    { target: { value: 'tenant-admin' } }
  );
  fireEvent.change(screen.getByLabelText('Admin-E-Mail', { selector: '#instance-admin-email' }), {
    target: { value: 'tenant-admin@example.org' },
  });
  fireEvent.change(
    screen.getByLabelText('Admin-Vorname', { selector: '#instance-admin-first-name' }),
    { target: { value: 'Tenant' } }
  );
  fireEvent.change(
    screen.getByLabelText('Admin-Nachname', { selector: '#instance-admin-last-name' }),
    { target: { value: 'Admin' } }
  );
};

describe('InstanceCreatePage', () => {
  let parentDomainMeta: HTMLMetaElement;

  beforeEach(() => {
    useInstancesMock.mockReset();
    navigateMock.mockReset();
    getDraftReadinessMock.mockReset().mockResolvedValue({ data: readyDraft });
    listRealmCatalogMock
      .mockReset()
      .mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 100, total: 0 } });
    parentDomainMeta = document.createElement('meta');
    parentDomainMeta.name = 'sva-studio-parent-domain';
    parentDomainMeta.content = 'dialog.kassel.de';
    document.head.append(parentDomainMeta);
  });

  afterEach(() => {
    parentDomainMeta.remove();
    cleanup();
  });

  it('creates a complete new-realm draft and opens the shared cockpit', async () => {
    const createInstance = vi.fn().mockResolvedValue({ instanceId: 'demo' });
    useInstancesMock.mockReturnValue(createInstancesApiState({ createInstance }));
    render(<InstanceCreatePage />);

    expect(screen.getByText('Smart Village App')).toBeTruthy();
    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    expect(screen.queryByLabelText('Tenant-Client-Secret')).toBeNull();
    expect(screen.getByText('Technische Details')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fillAdministrator();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => expect(getDraftReadinessMock).toHaveBeenCalledOnce());
    const createButton = screen.getByRole('button', { name: 'Instanz anlegen' });
    await waitFor(() => expect((createButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(createButton);

    await waitFor(() =>
      expect(createInstance).toHaveBeenCalledWith({
        instanceId: 'demo',
        displayName: 'Demo',
        parentDomain: 'dialog.kassel.de',
        realmMode: 'new',
        authRealm: 'demo',
        authClientId: 'sva-studio-login',
        authIssuerUrl: undefined,
        authClientSecret: undefined,
        tenantAdminClient: { clientId: 'sva-studio-realm-admin', secret: undefined },
        tenantAdminBootstrap: {
          username: 'tenant-admin',
          email: 'tenant-admin@example.org',
          firstName: 'Tenant',
          lastName: 'Admin',
        },
      })
    );
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/instances/$instanceId',
      params: { instanceId: 'demo' },
    });
  });

  it('links field errors and exposes accessible invalid-state metadata', () => {
    useInstancesMock.mockReturnValue(createInstancesApiState());
    render(<InstanceCreatePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    const instanceId = screen.getByLabelText('Instanz-ID', { selector: '#instance-id' });
    expect(instanceId.getAttribute('aria-invalid')).toBe('true');
    expect(instanceId.getAttribute('aria-describedby')).toBe('instance-id-error');
    expect(screen.getByRole('alert').querySelector('a')?.getAttribute('href')).toBe('#instance-id');
  });

  it('selects only eligible existing realms and defers secret capture', async () => {
    listRealmCatalogMock.mockResolvedValue({
      data: [
        { realm: 'master', status: 'disabled', reasonCode: 'system_realm' },
        { realm: 'occupied', status: 'disabled', reasonCode: 'already_assigned' },
        { realm: 'tenant-existing', status: 'selectable' },
      ],
      pagination: { page: 1, pageSize: 100, total: 3 },
    });
    useInstancesMock.mockReturnValue(createInstancesApiState());
    render(<InstanceCreatePage />);

    fireEvent.click(screen.getByRole('radio', { name: /Bestehender Realm:/u }));
    fillBasics('existing-demo');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(listRealmCatalogMock).toHaveBeenCalled());
    fireEvent.click(document.querySelector('#instance-auth-realm') as HTMLButtonElement);

    expect(screen.getByRole('option', { name: /master/u }).getAttribute('aria-disabled')).toBe(
      'true'
    );
    fireEvent.click(screen.getByRole('option', { name: 'tenant-existing' }));
    expect(document.querySelector('#instance-auth-realm')?.textContent).toContain(
      'tenant-existing'
    );
    expect(screen.queryByLabelText('Tenant-Client-Secret')).toBeNull();
    expect(screen.queryByLabelText('Tenant-Admin-Client-Secret')).toBeNull();
  });

  it('surfaces realm catalog failures instead of presenting an empty result', async () => {
    listRealmCatalogMock.mockRejectedValue({
      code: 'keycloak_unavailable',
      requestId: 'req-realm-catalog',
    });
    useInstancesMock.mockReturnValue(createInstancesApiState());
    render(<InstanceCreatePage />);

    fireEvent.click(screen.getByRole('radio', { name: /Bestehender Realm:/u }));
    fillBasics('existing-demo');
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => expect(listRealmCatalogMock).toHaveBeenCalled());
    expect(screen.getByRole('alert').textContent).toContain(
      'Keycloak konnte nicht erreicht oder nicht abgeglichen werden.'
    );
    expect(screen.getByRole('alert').textContent).toContain('Request-ID: req-realm-catalog');
  });

  it('keeps creation disabled and renders grouped authoritative blockers', async () => {
    getDraftReadinessMock.mockResolvedValue({
      data: {
        ...readyDraft,
        createBlockers: [
          {
            checkKey: 'realm_selection',
            title: 'Realm-Auswahl',
            status: 'blocked',
            summary: 'Der Realm ist bereits zugeordnet.',
            details: {},
          },
        ],
      },
    });
    useInstancesMock.mockReturnValue(createInstancesApiState());
    render(<InstanceCreatePage />);

    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fillAdministrator();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => expect(screen.getByText('Der Realm ist bereits zugeordnet.')).toBeTruthy());
    expect(screen.getByText('Vor der Anlage zu beheben')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Instanz anlegen' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('keeps a failed readiness request visible with its diagnostic request id', async () => {
    getDraftReadinessMock.mockRejectedValue({
      code: 'keycloak_unavailable',
      requestId: 'req-draft-readiness',
    });
    useInstancesMock.mockReturnValue(createInstancesApiState());
    render(<InstanceCreatePage />);

    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fillAdministrator();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => expect(getDraftReadinessMock).toHaveBeenCalledOnce());
    expect(screen.getByText('Request-ID: req-draft-readiness')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Instanz anlegen' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('ignores an obsolete readiness response after the draft changed', async () => {
    let resolveFirst: (value: { data: Record<string, unknown> }) => void = () => undefined;
    let resolveSecond: (value: { data: Record<string, unknown> }) => void = () => undefined;
    getDraftReadinessMock
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve as typeof resolveFirst))
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveSecond = resolve as typeof resolveSecond))
      );
    useInstancesMock.mockReturnValue(createInstancesApiState());
    render(<InstanceCreatePage />);

    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    fillAdministrator();
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(getDraftReadinessMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    fireEvent.change(
      screen.getByLabelText('Admin-Nachname', { selector: '#instance-admin-last-name' }),
      { target: { value: 'Changed' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(() => expect(getDraftReadinessMock).toHaveBeenCalledTimes(2));

    const currentBlocker = {
      ...readyDraft,
      createBlockers: [
        {
          checkKey: 'realm_selection',
          title: 'Realm-Auswahl',
          status: 'blocked',
          summary: 'Aktueller Entwurf ist blockiert.',
          details: {},
        },
      ],
    };
    await act(async () => resolveSecond({ data: currentBlocker }));
    await waitFor(() => expect(screen.getByText('Aktueller Entwurf ist blockiert.')).toBeTruthy());

    await act(async () => resolveFirst({ data: readyDraft }));
    expect(screen.getByText('Aktueller Entwurf ist blockiert.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Instanz anlegen' }) as HTMLButtonElement).disabled
    ).toBe(true);
  });
});
