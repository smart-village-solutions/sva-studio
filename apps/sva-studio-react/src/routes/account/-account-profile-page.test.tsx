import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccountProfilePage } from './-account-profile-page';

const getMyProfileMock = vi.fn();
const updateMyProfileMock = vi.fn();
const asIamErrorMock = vi.fn();
const fetchMock = vi.fn();
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
  invalidatePermissions: vi.fn(),
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
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

describe('AccountProfilePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
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
    getMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        username: 'jane.doe',
        displayName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+49 111111',
        position: 'Editor',
        department: 'News',
        preferredLanguage: 'de',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
    });

    updateMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        username: 'jane.doe',
        displayName: 'Janet Doe',
        firstName: 'Janet',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+49 222222',
        position: 'Lead Editor',
        department: 'Product',
        preferredLanguage: 'en',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
    });

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

    fireEvent.submit(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Profil wurde erfolgreich gespeichert.')).toBeTruthy();
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
  });

  it('shows unauthenticated state when profile cannot be loaded and user is not authenticated', async () => {
    const loadError = { status: 401, code: 'unauthorized', message: 'Unauthorized' };
    authMockValue.isAuthenticated = false;
    authMockValue.user = null as unknown as typeof authMockValue.user;
    asIamErrorMock.mockReturnValue(loadError);
    getMyProfileMock.mockRejectedValue(new Error('unauthorized'));

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Bitte zuerst anmelden, um Ihr Konto zu sehen.');
    });
    expect(screen.getByRole('link', { name: 'Login' }).getAttribute('href')).toBe('/auth/login?returnTo=%2F');
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
      expect(screen.getByText('Die Sitzung konnte nicht stabil wiederhergestellt werden. Bitte erneut anmelden.')).toBeTruthy();
    });
    expect(screen.getByText('Status: Recovery läuft')).toBeTruthy();
    expect(screen.getByText('Empfohlene Aktion: Erneut anmelden')).toBeTruthy();
    expect(screen.getByText('Request-ID: req-account-profile')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Login' }).getAttribute('href')).toBe('/auth/login?returnTo=%2F');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(authMockValue.refetch).not.toHaveBeenCalled();
  });

  it('derives the display name from first and last name when no custom display name exists', async () => {
    getMyProfileMock.mockResolvedValue({
      data: {
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
      },
    });
    updateMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        username: 'jane.doe',
        displayName: 'Janet Doe',
        firstName: 'Janet',
        lastName: 'Doe',
        email: 'jane@example.com',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
    });

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
    getMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        username: 'jane.doe',
        displayName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        preferredLanguage: 'de',
        timezone: 'Europe/Berlin',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
    });

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
    getMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        username: 'jane.doe',
        displayName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        status: 'active',
        roles: [
          { roleId: 'role-1', roleName: 'Editor' },
          { roleId: 'role-2', roleName: 'Reviewer' },
        ],
        mainserverUserApplicationSecretSet: false,
      },
    });

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
  });

  it('shows load error with retry and keeps display name fallback from auth user', async () => {
    const loadError = { status: 500, code: 'failed', message: 'failed' };
    asIamErrorMock.mockReturnValue(loadError);
    getMyProfileMock.mockRejectedValueOnce(new Error('failed-load'));
    getMyProfileMock.mockResolvedValueOnce({
      data: {
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
      },
    });

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Profil konnte nicht geladen werden.');
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
    getMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        username: 'jane.doe',
        displayName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '',
        status: 'active',
        roles: [],
        mainserverUserApplicationSecretSet: false,
      },
    });
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
      expect(screen.getByRole('alert').textContent).toContain('Bitte korrigieren Sie die markierten Felder.');
      expect(updateMyProfileMock).not.toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Vorname'), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText('Nachname'), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: '+49 1234567' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert').textContent).toContain('Profil konnte nicht gespeichert werden.');
    });
  });
});
