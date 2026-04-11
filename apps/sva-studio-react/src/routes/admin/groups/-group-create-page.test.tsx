import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupCreatePage } from './-group-create-page';

const useGroupsMock = vi.fn();
const navigateMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

vi.mock('../../../hooks/use-groups', () => ({
  useGroups: () => useGroupsMock(),
}));

const createGroupsState = (overrides: Record<string, unknown> = {}) => ({
  groups: [
    {
      id: 'group-1',
      groupKey: 'admins_team',
      displayName: 'Admins Team',
      description: 'Administrative Gruppe',
      groupType: 'role_bundle',
      isActive: true,
      memberCount: 0,
      roleCount: 0,
    },
  ],
  isLoading: false,
  error: null,
  mutationError: null,
  refetch: vi.fn(),
  clearMutationError: vi.fn(),
  createGroup: vi.fn().mockResolvedValue(true),
  updateGroup: vi.fn().mockResolvedValue(true),
  deleteGroup: vi.fn().mockResolvedValue(true),
  loadGroupDetail: vi.fn().mockResolvedValue(null),
  assignRole: vi.fn().mockResolvedValue(true),
  removeRole: vi.fn().mockResolvedValue(true),
  assignMembership: vi.fn().mockResolvedValue(true),
  removeMembership: vi.fn().mockResolvedValue(true),
  ...overrides,
});

describe('GroupCreatePage', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    useGroupsMock.mockReset();
    navigateMock.mockClear();
  });

  it('creates a group with normalized key and navigates to the detail page', async () => {
    const createGroup = vi.fn().mockResolvedValue(true);
    useGroupsMock.mockReturnValue(createGroupsState({ createGroup }));

    render(<GroupCreatePage />);

    fireEvent.change(screen.getByLabelText('Technischer Gruppenschlüssel', { selector: '#create-group-key' }), {
      target: { value: ' Admins Team ' },
    });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#create-group-name' }), {
      target: { value: ' Admins Team ' },
    });
    fireEvent.change(screen.getByLabelText('Beschreibung', { selector: '#create-group-description' }), {
      target: { value: ' Administrative Gruppe ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith({
        groupKey: 'admins_team',
        displayName: 'Admins Team',
        description: 'Administrative Gruppe',
      });
    });
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/groups/$groupId',
      params: { groupId: 'group-1' },
    });
  });

  it('navigates to the group list when the created group is not yet in the list snapshot', async () => {
    const createGroup = vi.fn().mockResolvedValue(true);
    useGroupsMock.mockReturnValue(createGroupsState({ createGroup, groups: [] }));

    render(<GroupCreatePage />);

    fireEvent.change(screen.getByLabelText('Technischer Gruppenschlüssel', { selector: '#create-group-key' }), {
      target: { value: ' editors ' },
    });
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#create-group-name' }), {
      target: { value: ' Editors ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalled();
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: '/admin/groups' });
  });

  it('renders mutation errors', () => {
    useGroupsMock.mockReturnValue(
      createGroupsState({
        mutationError: { status: 409, code: 'conflict', message: 'group exists' },
      })
    );

    render(<GroupCreatePage />);

    expect(screen.getByRole('alert').textContent).toContain('Die Gruppenänderung steht in Konflikt mit dem aktuellen Zustand.');
  });
});
