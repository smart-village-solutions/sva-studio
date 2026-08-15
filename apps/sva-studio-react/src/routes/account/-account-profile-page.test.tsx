import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountProfilePage } from './-account-profile-page';

const getMyProfileMock = vi.fn();
const updateMyProfileMock = vi.fn();
const asIamErrorMock = vi.fn();
const fetchMock = vi.fn();
type ProfileRoleFixture = {
  roleId: string;
  roleName: string;
};

type ProfileFixture = {
  id: string;
  keycloakSubject: string;
  username: string;
  displayName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  preferredLanguage?: string;
  timezone?: string;
  status: string;
  mappingStatus?: string;
  editability?: string;
  diagnostics?: Array<{ code: string }>;
  fieldEditability?: {
    profile?: string;
    status?: string;
    roles?: string;
  };
  roles: ProfileRoleFixture[];
  keycloakRoles?: string[];
  mainserverUserApplicationSecretSet: boolean;
};

const createProfileFixture = (overrides: Partial<ProfileFixture> = {}): ProfileFixture => ({
  id: 'account-1',
  keycloakSubject: 'subject-1',
  username: 'jane.doe',
  displayName: 'Jane Doe',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  status: 'active',
  roles: [],
  mainserverUserApplicationSecretSet: false,
  ...overrides,
});

const resolvedProfile = (overrides: Partial<ProfileFixture> = {}) => ({
  data: createProfileFixture(overrides),
});

const authMockValue = {
  user: {
    id: 'user-1',
    roles: ['editor'],
  },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  hasResolvedSession: true,
  refetch: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
};

vi.mock('../../lib/iam-api', () => ({
  IamHttpError: class IamHttpError extends Error {
    status: number;
    code: string;
    requestId?: string;
    classification?: string;
    recommendedAction?: string;

    constructor(input: {
      status: number;
      code: string;
      message: string;
      requestId?: string;
      classification?: string;
      recommendedAction?: string;
    }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
      this.requestId = input.requestId;
      this.classification = input.classification;
      this.recommendedAction = input.recommendedAction;
    }
  },
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
  updateMyProfile: (...args: unknown[]) => updateMyProfileMock(...args),
  asIamError: (...args: unknown[]) => asIamErrorMock(...args),
}));

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('AccountProfilePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    getMyProfileMock.mockReset();
    updateMyProfileMock.mockReset();
    asIamErrorMock.mockReset();
    asIamErrorMock.mockImplementation((cause: unknown) => cause);
    authMockValue.hasResolvedSession = true;
    authMockValue.isLoading = false;
    authMockValue.isAuthenticated = true;
    authMockValue.user = {
      id: 'user-1',
      roles: ['editor'],
    };
    authMockValue.refetch.mockReset();
  });

  it('loads profile and submits updates', async () => {
    getMyProfileMock.mockResolvedValue(
      resolvedProfile({
        phone: '+49 111111',
        position: 'Editor',
        department: 'News',
        preferredLanguage: 'de',
      })
    );

    updateMyProfileMock.mockResolvedValue(
      resolvedProfile({
        displayName: 'Janet Doe',
        firstName: 'Janet',
        phone: '+49 222222',
        position: 'Lead Editor',
        department: 'Product',
        preferredLanguage: 'en',
      })
    );

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Vorname'), {
      target: { value: 'Janet' },
    });
    fireEvent.change(screen.getByLabelText('Telefon'), {
      target: { value: '+49 222222' },
    });
    fireEvent.change(screen.getByLabelText('Position'), {
      target: { value: 'Lead Editor' },
    });
    fireEvent.change(screen.getByLabelText('Abteilung'), {
      target: { value: 'Product' },
    });
    fireEvent.change(screen.getByLabelText('Sprache'), {
      target: { value: 'en' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
    });

    const saveButton = screen.getByRole('button', { name: 'Speichern' });
    saveButton.focus();
    fireEvent.submit(saveButton);

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Gespeichert' })).toBeTruthy();
    });
    expect(updateMyProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Janet',
        lastName: 'Doe',
        displayName: 'Janet Doe',
        phone: '+49 222222',
        position: 'Lead Editor',
        department: 'Product',
        preferredLanguage: 'en',
      })
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Gespeichert' }));
  });

  it('shows a success status after returning from password update', async () => {
    window.history.replaceState({}, '', '/account?accountAction=password-updated');
    getMyProfileMock.mockResolvedValue(resolvedProfile());

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Das Passwort wurde aktualisiert.')).toBeTruthy();
    });
  });

  it('shows a completion status after returning from email update', async () => {
    window.history.replaceState({}, '', '/account?accountAction=email-update-finished');
    getMyProfileMock.mockResolvedValue(resolvedProfile());

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Die E-Mail-Änderung wurde abgeschlossen.')).toBeTruthy();
    });
  });

  it('re-reads the account action status when the same page is rendered with updated query params', async () => {
    window.history.replaceState({}, '', '/account?accountAction=password-updated');
    getMyProfileMock.mockResolvedValue(resolvedProfile());

    const { rerender } = render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Das Passwort wurde aktualisiert.')).toBeTruthy();
    });

    window.history.replaceState({}, '', '/account?accountAction=email-update-finished');
    rerender(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Die E-Mail-Änderung wurde abgeschlossen.')).toBeTruthy();
    });
  });

  it('shows an unavailable status after returning from an unsupported email update flow', async () => {
    window.history.replaceState({}, '', '/account?accountAction=email-update-unavailable');
    getMyProfileMock.mockResolvedValue(resolvedProfile());

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Die E-Mail-Änderung ist in dieser Keycloak-Umgebung derzeit nicht verfügbar.'
        )
      ).toBeTruthy();
    });
  });

  it('shows a cancellation status after returning from a cancelled account action', async () => {
    window.history.replaceState(
      {},
      '',
      '/account?accountAction=cancelled&accountActionType=update-email'
    );
    getMyProfileMock.mockResolvedValue(resolvedProfile());

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Die Aktion wurde abgebrochen.')).toBeTruthy();
    });
  });

  it.each(['/account', '/account?accountAction=unexpected-value'])(
    'does not show a credential status for a missing or invalid action parameter at %s',
    async (route) => {
      window.history.replaceState({}, '', route);
      getMyProfileMock.mockResolvedValue(resolvedProfile());

      render(<AccountProfilePage />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
      });

      expect(screen.queryByText('Das Passwort wurde aktualisiert.')).toBeNull();
      expect(screen.queryByText('Die E-Mail-Änderung wurde abgeschlossen.')).toBeNull();
      expect(
        screen.queryByText(
          'Die E-Mail-Änderung ist in dieser Keycloak-Umgebung derzeit nicht verfügbar.'
        )
      ).toBeNull();
      expect(screen.queryByText('Die Aktion wurde abgebrochen.')).toBeNull();
    }
  );

  it('does not render a separate privacy cockpit entry point on the profile page', async () => {
    getMyProfileMock.mockResolvedValue(resolvedProfile());

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    expect(screen.queryByText('Datenschutz-Cockpit öffnen')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Zum Datenschutz-Cockpit' })).toBeNull();
  });

  it('shows unauthenticated state when profile cannot be loaded and user is not authenticated', async () => {
    const loadError = { status: 401, code: 'unauthorized', message: 'Unauthorized' };
    authMockValue.isAuthenticated = false;
    authMockValue.user = null as unknown as typeof authMockValue.user;
    asIamErrorMock.mockReturnValue(loadError);
    getMyProfileMock.mockRejectedValue(new Error('unauthorized'));

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain(
        'Bitte zuerst anmelden, um Ihr Konto zu sehen.'
      );
    });
    expect(screen.getByRole('link', { name: 'Login' }).getAttribute('href')).toBe(
      '/auth/login?returnTo=%2F'
    );
  });

  it('waits for resolved auth before loading the profile', () => {
    authMockValue.isLoading = true;
    authMockValue.hasResolvedSession = false;

    render(<AccountProfilePage />);

    expect(getMyProfileMock).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('Profil wird geladen ...');
  });

  it('shows request id and recommended action when the profile request returns 401', async () => {
    const loadError = {
      status: 401,
      code: 'unauthorized',
      message: 'Unauthorized',
      requestId: 'req-account-profile',
      classification: 'session_store_or_session_hydration',
      diagnosticStatus: 'recovery_laeuft',
      recommendedAction: 'erneut_anmelden',
    };
    asIamErrorMock.mockReturnValue(loadError);
    getMyProfileMock.mockRejectedValue(loadError);

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Die Sitzung konnte nicht stabil wiederhergestellt werden. Bitte erneut anmelden.'
        )
      ).toBeTruthy();
    });
    expect(screen.getByText('Status: Recovery läuft')).toBeTruthy();
    expect(screen.getByText('Empfohlene Aktion: Erneut anmelden')).toBeTruthy();
    expect(screen.getByText('Request-ID: req-account-profile')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Login' }).getAttribute('href')).toBe(
      '/auth/login?returnTo=%2F'
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authMockValue.refetch).not.toHaveBeenCalled();
  });

  it('offers login recovery for a non-401 profile error that recommends signing in again', async () => {
    const loadError = {
      status: 503,
      code: 'session_recovery_required',
      message: 'Session recovery required',
      recommendedAction: 'erneut_anmelden',
    };
    asIamErrorMock.mockReturnValue(loadError);
    getMyProfileMock.mockRejectedValue(loadError);

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Bitte zuerst anmelden, um Ihr Konto zu sehen.')).toBeTruthy();
    });
    expect(screen.getByRole('link', { name: 'Login' }).getAttribute('href')).toBe(
      '/auth/login?returnTo=%2F'
    );
    expect(screen.queryByRole('button', { name: 'Erneut versuchen' })).toBeNull();
  });

  it.each([
    [
      'actor_resolution_or_membership',
      'Ihr Konto ist technisch erreichbar, aber die fachliche Zuordnung oder Instanz-Mitgliedschaft ist unvollständig.',
    ],
    [
      'database_or_schema_drift',
      'Die Kontodaten sind derzeit wegen einer Datenbank- oder Migrationsabweichung nur eingeschränkt verfügbar.',
    ],
    [
      'registry_or_provisioning_drift',
      'Die Kontodaten sind derzeit wegen eines Registry- oder Provisioning-Drifts nur eingeschränkt verfügbar.',
    ],
    [
      'keycloak_dependency',
      'Die Kontoansicht kann derzeit nicht vollständig geladen werden, weil Keycloak oder ein nachgelagerter Rollenabgleich nicht stabil verfügbar ist.',
    ],
    [
      'keycloak_reconcile',
      'Die Kontoansicht kann derzeit nicht vollständig geladen werden, weil Keycloak oder ein nachgelagerter Rollenabgleich nicht stabil verfügbar ist.',
    ],
    ['unknown', 'Profil konnte nicht geladen werden.'],
  ])(
    'maps the %s load-error classification to its existing guidance',
    async (classification, text) => {
      const loadError = { status: 500, code: 'failed', message: 'failed', classification };
      asIamErrorMock.mockReturnValue(loadError);
      getMyProfileMock.mockRejectedValue(loadError);

      render(<AccountProfilePage />);

      await waitFor(() => {
        expect(screen.getAllByText(text).length).toBeGreaterThan(0);
      });
      expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeTruthy();
    }
  );

  it('shows projection diagnostics when the loaded profile is in manual review', async () => {
    getMyProfileMock.mockResolvedValue(
      resolvedProfile({
        mappingStatus: 'manual_review',
        editability: 'blocked',
        diagnostics: [{ code: 'keycloak_projection_degraded' }],
        fieldEditability: {
          profile: 'editable',
          status: 'read_only',
          roles: 'blocked',
        },
      })
    );

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profilstatus erfordert manuelle Prüfung.')).toBeTruthy();
    });
    expect(screen.getByText('Projektionsstatus: Manuelle Prüfung')).toBeTruthy();
    expect(screen.getByText('Bearbeitbarkeit: Blockiert')).toBeTruthy();
    expect(screen.getByText('Diagnosecodes: keycloak_projection_degraded')).toBeTruthy();
  });

  it('renders platform profiles as read only and does not offer the tenant-local save path', async () => {
    authMockValue.user = {
      id: 'platform-user-1',
      roles: ['instance_registry_admin'],
    };
    getMyProfileMock.mockResolvedValue(
      resolvedProfile({
        username: 'platform.admin',
        displayName: 'Platform Admin',
        firstName: 'Platform',
        lastName: 'Admin',
        email: 'platform@example.com',
        roles: [{ roleId: 'role-1', roleName: 'instance_registry_admin' }],
      })
    );

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'Plattform-Profile sind hier nur lesbar. Änderungen werden nicht über den tenantlokalen Profilpfad gespeichert.'
    );
    expect((screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement).disabled).toBe(
      true
    );
    for (const label of ['Vorname', 'Nachname', 'Telefon', 'Position', 'Abteilung', 'Sprache']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
    }
    expect(updateMyProfileMock).not.toHaveBeenCalled();
  });

  it('trims editable fields and omits empty optional values from the mutation', async () => {
    getMyProfileMock.mockResolvedValue(
      resolvedProfile({
        phone: '+49 111111',
        position: 'Editor',
        department: 'News',
        preferredLanguage: 'de',
      })
    );
    updateMyProfileMock.mockResolvedValue(resolvedProfile());

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: '  Jane  ' } });
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: '  Doe  ' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Abteilung'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('Sprache'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(1);
    });
    expect(updateMyProfileMock).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
      phone: undefined,
      position: undefined,
      department: undefined,
      preferredLanguage: undefined,
    });
  });

  it('derives the display name from first and last name when no custom display name exists', async () => {
    getMyProfileMock.mockResolvedValue(resolvedProfile());
    updateMyProfileMock.mockResolvedValue(
      resolvedProfile({
        displayName: 'Janet Doe',
        firstName: 'Janet',
      })
    );

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Vorname'), {
      target: { value: 'Janet' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(1);
    });

    expect(updateMyProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Janet',
        displayName: 'Janet Doe',
      })
    );
  });

  it('hides timezone and non-editable account identity fields', async () => {
    getMyProfileMock.mockResolvedValue(
      resolvedProfile({
        preferredLanguage: 'de',
        timezone: 'Europe/Berlin',
      })
    );

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    expect(screen.queryByLabelText('Zeitzone')).toBeNull();
    expect(screen.queryByLabelText('Benutzername')).toBeNull();
    expect(screen.queryByLabelText('E-Mail')).toBeNull();
    expect(screen.queryByLabelText('Anzeigename')).toBeNull();
  });

  it('shows roles and status as readonly fields', async () => {
    getMyProfileMock.mockResolvedValue(
      resolvedProfile({
        roles: [
          { roleId: 'role-1', roleName: 'Editor' },
          { roleId: 'role-2', roleName: 'Reviewer' },
        ],
        keycloakRoles: ['legacy_editor', 'system_admin'],
      })
    );

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    const statusField = screen.getByLabelText('Status') as HTMLInputElement;
    const roleField = screen.getByLabelText('Rolle') as HTMLInputElement;

    expect(statusField.readOnly).toBe(true);
    expect(statusField.value).toBe('Aktiv');
    expect(roleField.readOnly).toBe(true);
    expect(roleField.value).toBe('Editor, Reviewer');
    expect((screen.getByLabelText('Technische Keycloak-Rollen') as HTMLInputElement).value).toBe(
      'legacy_editor, system_admin'
    );
  });

  it('shows load error with retry and keeps display name fallback from auth user', async () => {
    const loadError = { status: 500, code: 'failed', message: 'failed' };
    asIamErrorMock.mockReturnValue(loadError);
    getMyProfileMock.mockRejectedValueOnce(new Error('failed-load'));
    getMyProfileMock.mockResolvedValueOnce(resolvedProfile());

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Profil konnte nicht geladen werden.'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() => {
      expect(getMyProfileMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });
  });

  it('shows validation summary and save error branch', async () => {
    const saveError = { status: 500, code: 'save_failed', message: 'save failed' };
    asIamErrorMock.mockReturnValue(saveError);
    getMyProfileMock.mockResolvedValue(
      resolvedProfile({
        phone: '',
      })
    );
    updateMyProfileMock.mockRejectedValueOnce(new Error('save_failed'));

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: 'bad-phone' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Bitte korrigieren Sie die markierten Felder.'
      );
      expect(updateMyProfileMock).not.toHaveBeenCalled();
    });
    const validationSummary = screen
      .getByText('Bitte korrigieren Sie die markierten Felder.')
      .closest('[role="alert"]');
    expect(validationSummary).toBeTruthy();
    expect(document.activeElement).toBe(validationSummary);
    expect(screen.getByLabelText('Vorname').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Nachname').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Telefon').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '+49 1234567' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert').textContent).toContain(
        'Profil konnte nicht gespeichert werden.'
      );
    });

    updateMyProfileMock.mockResolvedValueOnce(resolvedProfile());
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Gespeichert' })).toBeTruthy();
    });
  });
});
