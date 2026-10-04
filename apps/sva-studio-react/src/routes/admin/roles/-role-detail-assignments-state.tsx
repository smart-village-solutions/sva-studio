import React from 'react';

import { useRoles } from '../../../hooks/use-roles';
import { useUsers } from '../../../hooks/use-users';

export const useRoleAssignmentsState = ({
  role,
}: Readonly<{
  role: ReturnType<typeof useRoles>['roles'][number] | null;
}>) => {
  const usersApi = useUsers({ page: 1, pageSize: 100 });
  const [isUpdatingAssignmentsForUserIds, setIsUpdatingAssignmentsForUserIds] = React.useState<
    string[]
  >([]);
  const assignedUsers = React.useMemo(() => {
    if (!role) {
      return [];
    }

    return usersApi.users.filter((user) =>
      user.roles.some((assignment) => assignment.roleId === role.id)
    );
  }, [role, usersApi.users]);

  const unassignedUsers = React.useMemo(() => {
    if (!role) {
      return [];
    }

    return usersApi.users.filter((user) =>
      user.roles.every((assignment) => assignment.roleId !== role.id)
    );
  }, [role, usersApi.users]);

  const updateRoleAssignment = async (userId: string, nextRoleIds: readonly string[]) => {
    setIsUpdatingAssignmentsForUserIds((current) => [...current, userId]);
    try {
      await usersApi.updateUser(userId, {
        roleIds: nextRoleIds,
      });
    } finally {
      setIsUpdatingAssignmentsForUserIds((current) => current.filter((entry) => entry !== userId));
    }
  };

  const assignRoleToUser = async (userId: string, currentRoleIds: readonly string[]) => {
    if (!role) {
      return;
    }

    const nextRoleIds = currentRoleIds.includes(role.id)
      ? [...currentRoleIds]
      : [...currentRoleIds, role.id];
    await updateRoleAssignment(userId, nextRoleIds);
  };

  const removeRoleFromUser = async (userId: string, currentRoleIds: readonly string[]) => {
    if (!role) {
      return;
    }

    await updateRoleAssignment(
      userId,
      currentRoleIds.filter((entry) => entry !== role.id)
    );
  };

  return {
    usersApi,
    isUpdatingAssignmentsForUserIds,
    assignedUsers,
    unassignedUsers,
    updateRoleAssignment,
    assignRoleToUser,
    removeRoleFromUser,
  };
};
