import { useStudioSaveFeedback } from '@sva/studio-ui-react';
import React from 'react';

import {
  createStudioDataTableLabels,
  createStudioDataTableSortingLabels,
} from '../../../components/studio-data-table-labels';
import { useRolePermissions } from '../../../hooks/use-role-permissions';
import { useRoles } from '../../../hooks/use-roles';

import {
  PermissionAccessScope,
  RolePermissionTableRow,
  buildPermissionScopeDraft,
  sortPermissionAssignmentsByCatalog,
  sortPermissionIdsByCatalog,
} from './-role-detail-permission-model';
import { useRolePermissionTable } from './-role-detail-permission-table';
export const useRolePermissionState = ({
  role,
  isReadOnly,
  rolesApi,
}: Readonly<{
  role: ReturnType<typeof useRoles>['roles'][number] | null;
  isReadOnly: boolean;
  rolesApi: ReturnType<typeof useRoles>;
}>) => {
  const permissionsApi = useRolePermissions();
  const studioDataTableLabels = createStudioDataTableLabels();
  const studioDataTableSortingLabels = createStudioDataTableSortingLabels();
  const [permissionDraft, setPermissionDraft] = React.useState<string[]>([]);
  const [permissionScopeDraft, setPermissionScopeDraft] = React.useState<
    Record<string, PermissionAccessScope>
  >({});
  const permissionsSaveFeedback = useStudioSaveFeedback();
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);
  const [permissionSearch, setPermissionSearch] = React.useState('');
  React.useEffect(() => {
    if (!role) return;
    setPermissionDraft(
      sortPermissionIdsByCatalog(
        role.permissions.map((permission) => permission.id),
        permissionsApi.permissions
      )
    );
    setPermissionScopeDraft(buildPermissionScopeDraft(role, permissionsApi.permissions));
  }, [permissionsApi.permissions, role]);

  const togglePermissionDraft = (permissionId: string) => {
    permissionsSaveFeedback.markDirty();
    setPermissionDraft((current) => {
      const nextIds = current.includes(permissionId)
        ? current.filter((entry) => entry !== permissionId)
        : [...current, permissionId];

      return sortPermissionIdsByCatalog(nextIds, permissionsApi.permissions);
    });
    setPermissionScopeDraft((current) => ({
      ...current,
      [permissionId]: current[permissionId] ?? 'all',
    }));
  };

  const table = useRolePermissionTable({
    permissionsApi,
    permissionDraft,
    permissionScopeDraft,
    permissionSearch,
    isReadOnly,
    permissionsSaveFeedback,
    showTechnicalDetails,
    setPermissionScopeDraft,
    togglePermissionDraft,
  });
  const bulk = useRolePermissionBulkActions({
    permissionsApi,
    permissionsSaveFeedback,
    setPermissionDraft,
    setPermissionScopeDraft,
    filteredPermissionTableRows: table.filteredPermissionTableRows,
  });
  const onSavePermissions = async () => {
    if (!role || isReadOnly) {
      return;
    }

    const operationId = permissionsSaveFeedback.beginSaving();
    const updated = await rolesApi.updateRole(role.id, {
      permissionAssignments: sortPermissionAssignmentsByCatalog(
        permissionDraft,
        permissionDraft.reduce<Record<string, PermissionAccessScope>>((acc, permissionId) => {
          acc[permissionId] = permissionScopeDraft[permissionId] ?? 'all';
          return acc;
        }, {}),
        permissionsApi.permissions
      ),
    });
    (updated ? permissionsSaveFeedback.markSaved : permissionsSaveFeedback.markFailed)(operationId);
  };

  const resetPermissionDraft = () => {
    if (!role) {
      return;
    }

    setPermissionDraft(
      sortPermissionIdsByCatalog(
        role.permissions.map((permission) => permission.id),
        permissionsApi.permissions
      )
    );
    setPermissionScopeDraft(buildPermissionScopeDraft(role, permissionsApi.permissions));
  };

  return {
    permissionsApi,
    studioDataTableLabels,
    studioDataTableSortingLabels,
    permissionDraft,
    setPermissionDraft,
    permissionScopeDraft,
    setPermissionScopeDraft,
    permissionsSaveFeedback,
    showTechnicalDetails,
    setShowTechnicalDetails,
    permissionSearch,
    setPermissionSearch,
    onSavePermissions,
    resetPermissionDraft,
    togglePermissionDraft,
    ...table,
    ...bulk,
  };
};

export const useRolePermissionBulkActions = ({
  permissionsApi,
  permissionsSaveFeedback,
  setPermissionDraft,
  setPermissionScopeDraft,
  filteredPermissionTableRows,
}: Readonly<{
  permissionsApi: ReturnType<typeof useRolePermissions>;
  permissionsSaveFeedback: ReturnType<typeof useStudioSaveFeedback>;
  setPermissionDraft: React.Dispatch<React.SetStateAction<string[]>>;
  setPermissionScopeDraft: React.Dispatch<
    React.SetStateAction<Record<string, PermissionAccessScope>>
  >;
  filteredPermissionTableRows: readonly RolePermissionTableRow[];
}>) => {
  const assignAllPermissions = React.useCallback(() => {
    permissionsSaveFeedback.markDirty();
    setPermissionDraft(
      sortPermissionIdsByCatalog(
        permissionsApi.permissions.map((permission) => permission.id),
        permissionsApi.permissions
      )
    );
    setPermissionScopeDraft((current) =>
      permissionsApi.permissions.reduce<Record<string, PermissionAccessScope>>(
        (acc, permission) => {
          acc[permission.id] = current[permission.id] ?? 'all';
          return acc;
        },
        { ...current }
      )
    );
  }, [permissionsApi.permissions, permissionsSaveFeedback]);

  const removeAllPermissions = React.useCallback(() => {
    permissionsSaveFeedback.markDirty();
    setPermissionDraft([]);
  }, [permissionsSaveFeedback]);

  const applyPermissionBulkAssignment = React.useCallback(
    (permissionIds: readonly string[], nextAssigned: boolean) => {
      permissionsSaveFeedback.markDirty();
      setPermissionDraft((current) => {
        const nextIds = nextAssigned
          ? [...new Set([...current, ...permissionIds])]
          : current.filter((permissionId) => !permissionIds.includes(permissionId));

        return sortPermissionIdsByCatalog(nextIds, permissionsApi.permissions);
      });
      if (nextAssigned) {
        setPermissionScopeDraft((current) =>
          permissionIds.reduce<Record<string, PermissionAccessScope>>(
            (acc, permissionId) => {
              acc[permissionId] = current[permissionId] ?? 'all';
              return acc;
            },
            { ...current }
          )
        );
      }
    },
    [permissionsApi.permissions, permissionsSaveFeedback]
  );

  const assignVisiblePermissions = React.useCallback(() => {
    applyPermissionBulkAssignment(
      filteredPermissionTableRows.map((permission) => permission.id),
      true
    );
  }, [applyPermissionBulkAssignment, filteredPermissionTableRows]);

  const removeVisiblePermissions = React.useCallback(() => {
    applyPermissionBulkAssignment(
      filteredPermissionTableRows.map((permission) => permission.id),
      false
    );
  }, [applyPermissionBulkAssignment, filteredPermissionTableRows]);

  return {
    assignAllPermissions,
    removeAllPermissions,
    applyPermissionBulkAssignment,
    assignVisiblePermissions,
    removeVisiblePermissions,
  };
};
