import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountProfilePage } from './-account-profile-page';

const getMyProfileMock = vi.fn();
const updateMyProfileMock = vi.fn();
const authMockValue = {
  user: {
    id: 'user-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    roles: ['editor'],
  },
  isAuthenticated: true,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  logout: vi.fn(),
  invalidatePermissions: vi.fn(),
};

vi.mock('../../lib/iam-api', () => ({
  IamHttpError: class IamHttpError extends Error {
    status: number;
    code: string;

    constructor(input: { status: number; code: string; message: string }) {
      super(input.message);
      this.status = input.status;
      this.code = input.code;
    }
  },
  getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
  updateMyProfile: (...args: unknown[]) => updateMyProfileMock(...args),
}));

vi.mock('../../providers/auth-provider', () => ({
  useAuth: () => authMockValue,
}));

describe('AccountProfilePage', () => {
  it('loads profile and submits updates', async () => {
    getMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        displayName: 'Jane Doe',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        status: 'active',
        roles: [],
      },
    });

    updateMyProfileMock.mockResolvedValue({
      data: {
        id: 'account-1',
        keycloakSubject: 'subject-1',
        displayName: 'Jane D.',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        status: 'active',
        roles: [],
      },
    });

    render(<AccountProfilePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mein Konto' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Anzeigename'), {
      target: { value: 'Jane D.' },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Speichern' })).toBeTruthy();
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(updateMyProfileMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Profil wurde erfolgreich gespeichert.')).toBeTruthy();
    });
  });
});
