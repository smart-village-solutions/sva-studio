import {
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { useRoles } from '../../../hooks/use-roles';
import { isTenantRoleReadOnly, isTenantRoleVisible } from '../../../lib/iam-role-governance';

import { useRoleAssignmentsState } from './-role-detail-assignments-state';
import type { RoleDetailPageProps, RoleDetailTab } from './-role-detail-page';
import { useRolePermissionState } from './-role-detail-permissions-state';

export const useRoleDetailState = ({ roleId }: RoleDetailPageProps) => {
  const location = useLocation();
  const rolesApi = useRoles();
  const access = useIamResourceAccess('role');
  const canUpdateRole = isIamAccessAllowed(access.update);
  const navigate = useNavigate();
  const visibleRoles = React.useMemo(
    () => rolesApi.roles.filter((entry) => isTenantRoleVisible(entry)),
    [rolesApi.roles]
  );
  const role = React.useMemo(
    () => visibleRoles.find((entry) => entry.id === roleId) ?? null,
    [roleId, visibleRoles]
  );
  const isReadOnly = !canUpdateRole || (role ? isTenantRoleReadOnly(role) : true);
  const permissionsState = useRolePermissionState({ role, isReadOnly, rolesApi });
  const assignmentsState = useRoleAssignmentsState({ role });
  const [editForm, setEditForm] = React.useState({
    displayName: '',
    description: '',
  });
  const metaSaveFeedback = useStudioSaveFeedback();
  const initialSaveFeedbackShownRef = React.useRef(false);
  const updateEditForm: typeof setEditForm = (value) => {
    metaSaveFeedback.markDirty();
    setEditForm(value);
  };

  React.useEffect(() => {
    if (
      rolesApi.isLoading ||
      !role ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'roles', roleId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    metaSaveFeedback.showSaved();
    void navigate({
      to: '/admin/roles/$roleId',
      params: { roleId },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [location.state, metaSaveFeedback, navigate, role, roleId, rolesApi.isLoading]);

  React.useEffect(() => {
    if (!role) return;
    setEditForm({ displayName: role.roleName, description: role.description ?? '' });
  }, [permissionsState.permissionsApi.permissions, role]);

  const onTabIntent = (tab: RoleDetailTab): void => {
    void Promise.resolve(
      navigate({
        to: '/admin/roles/$roleId',
        params: { roleId },
        search: { tab },
        replace: true,
      })
    ).catch(() => undefined);
  };

  const onSaveGeneral = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role || isReadOnly) {
      return;
    }

    const operationId = metaSaveFeedback.beginSaving();
    const updated = await rolesApi.updateRole(role.id, {
      displayName: editForm.displayName.trim(),
      description: editForm.description.trim() || undefined,
    });
    (updated ? metaSaveFeedback.markSaved : metaSaveFeedback.markFailed)(operationId);
  };

  return {
    rolesApi,
    role,
    isReadOnly,
    editForm,
    setEditForm,
    metaSaveFeedback,
    updateEditForm,
    onTabIntent,
    onSaveGeneral,
    ...permissionsState,
    ...assignmentsState,
  };
};
export type RoleDetailState = ReturnType<typeof useRoleDetailState>;
