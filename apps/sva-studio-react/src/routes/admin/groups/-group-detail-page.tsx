import type { IamGroupDetail as IamAdminGroupDetail } from '@sva/iam-core';
import {
  Button,
  hasStudioCreatedSaveFeedback,
  removeStudioSaveFeedback,
  StudioPageTitle,
  StudioPersistentFormError,
  useStudioSaveFeedback,
} from '@sva/studio-ui-react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';

import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { IamRuntimeDiagnosticDetails } from '../../../components/iam-runtime-diagnostic-details';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Card } from '../../../components/ui/card';
import { useGroups } from '../../../hooks/use-groups';
import { isIamAccessAllowed, useIamResourceAccess } from '../../../hooks/use-iam-resource-access';
import { useRoles } from '../../../hooks/use-roles';
import { t } from '../../../i18n';
import { parseOptionalEditorDateTime } from '../../../lib/editor-date-time';
import { diffGroupRoleIds, groupErrorMessage } from './-group-shared';

import { GroupDetailEditForm } from './-group-detail-edit-form';
import { GroupDetailMemberships } from './-group-detail-memberships';

type GroupDetailPageProps = {
  readonly groupId: string;
};

type EditFormState = {
  displayName: string;
  description: string;
  roleIds: string[];
  isActive: boolean;
};

type MembershipFormState = {
  keycloakSubject: string;
  validFrom: string;
  validUntil: string;
};

const emptyMembershipForm = (): MembershipFormState => ({
  keycloakSubject: '',
  validFrom: '',
  validUntil: '',
});

const useGroupDetailState = ({ groupId }: GroupDetailPageProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const groupsApi = useGroups();
  const rolesApi = useRoles();
  const access = useIamResourceAccess('group');
  const canUpdateGroup = isIamAccessAllowed(access.update);
  const canDeleteGroup = isIamAccessAllowed(access.delete);
  const {
    isLoading,
    detailError,
    mutationError,
    loadGroupDetail,
    updateGroup,
    assignRole,
    removeRole,
    assignMembership,
    removeMembership,
    deleteGroup,
  } = groupsApi;
  const [group, setGroup] = React.useState<IamAdminGroupDetail | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formValues, setFormValues] = React.useState<EditFormState>({
    displayName: '',
    description: '',
    roleIds: [],
    isActive: true,
  });
  const [membershipForm, setMembershipForm] =
    React.useState<MembershipFormState>(emptyMembershipForm);
  const saveFeedback = useStudioSaveFeedback();
  const initialSaveFeedbackShownRef = React.useRef(false);
  React.useEffect(() => {
    if (
      isLoading ||
      !group ||
      initialSaveFeedbackShownRef.current ||
      !hasStudioCreatedSaveFeedback(location.state, 'groups', groupId)
    ) {
      return;
    }

    initialSaveFeedbackShownRef.current = true;
    saveFeedback.showSaved();
    void navigate({
      to: '/admin/groups/$groupId',
      params: { groupId },
      replace: true,
      state: (previous) => removeStudioSaveFeedback(previous),
    });
  }, [group, groupId, isLoading, location.state, navigate, saveFeedback]);
  const setDirtyFormValues: typeof setFormValues = (value) => {
    saveFeedback.markDirty();
    setFormValues(value);
  };

  const loadDetail = React.useCallback(async () => {
    const detail = await loadGroupDetail(groupId);
    if (!detail) {
      return null;
    }

    setGroup(detail);
    setFormValues({
      displayName: detail.displayName,
      description: detail.description ?? '',
      roleIds: [...detail.assignedRoleIds],
      isActive: detail.isActive,
    });
    return detail;
  }, [groupId, loadGroupDetail]);

  React.useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const onEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!group || !canUpdateGroup) {
      return;
    }

    const operationId = saveFeedback.beginSaving();
    const updated = await updateGroup(groupId, {
      displayName: formValues.displayName.trim(),
      description: formValues.description.trim() || undefined,
      isActive: formValues.isActive,
    });
    if (!updated) {
      saveFeedback.markFailed(operationId);
      return;
    }

    const { roleIdsToAssign, roleIdsToRemove } = diffGroupRoleIds(
      group.assignedRoleIds,
      formValues.roleIds
    );

    for (const roleId of roleIdsToAssign) {
      const assigned = await assignRole(groupId, roleId);
      if (!assigned) {
        saveFeedback.markFailed(operationId);
        return;
      }
    }

    for (const roleId of roleIdsToRemove) {
      const removed = await removeRole(groupId, roleId);
      if (!removed) {
        saveFeedback.markFailed(operationId);
        return;
      }
    }

    await loadDetail();
    saveFeedback.markSaved(operationId);
  };

  const onAssignMembership = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpdateGroup) {
      return;
    }
    setFormError(null);

    const validFrom = parseOptionalEditorDateTime(membershipForm.validFrom);
    const validUntil = parseOptionalEditorDateTime(membershipForm.validUntil);
    if (validFrom.kind === 'invalid' || validUntil.kind === 'invalid') {
      setFormError(t('admin.groups.validation.membershipDateInvalid'));
      return;
    }

    const assigned = await assignMembership(groupId, {
      keycloakSubject: membershipForm.keycloakSubject.trim(),
      validFrom: validFrom.kind === 'value' ? validFrom.value : undefined,
      validUntil: validUntil.kind === 'value' ? validUntil.value : undefined,
    });
    if (!assigned) {
      return;
    }

    setMembershipForm(emptyMembershipForm());
    await loadDetail();
  };

  const onRemoveMembership = async (keycloakSubject: string) => {
    if (!canUpdateGroup) {
      return;
    }
    const removed = await removeMembership(groupId, keycloakSubject);
    if (!removed) {
      return;
    }

    await loadDetail();
  };

  const onDelete = async () => {
    if (!canDeleteGroup) {
      return;
    }
    const deleted = await deleteGroup(groupId);
    if (deleted) {
      setDeleteConfirmOpen(false);
    }
  };

  return {
    isLoading,
    detailError,
    mutationError,
    rolesApi,
    group,
    canUpdateGroup,
    canDeleteGroup,
    formError,
    formValues,
    setDirtyFormValues,
    membershipForm,
    setMembershipForm,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    saveFeedback,
    onEdit,
    onAssignMembership,
    onRemoveMembership,
    onDelete,
  };
};

export type GroupDetailState = ReturnType<typeof useGroupDetailState>;

export const GroupDetailPage = ({ groupId }: GroupDetailPageProps) => {
  const state = useGroupDetailState({ groupId });
  const {
    isLoading,
    detailError,
    mutationError,
    group,
    canDeleteGroup,
    formError,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    onDelete,
  } = state;
  return (
    <section className="space-y-5" aria-busy={isLoading}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <StudioPageTitle withAccessory>
            {group?.displayName ?? t('admin.groups.dialogs.editTitle')}
          </StudioPageTitle>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {group
              ? t('admin.groups.dialogs.editDescription', { groupKey: group.groupKey })
              : t('admin.groups.messages.loading')}
          </p>
        </div>
        <Button asChild type="button" variant="secondary">
          <Link to="/admin/groups">{t('admin.groups.detail.backToList')}</Link>
        </Button>
      </header>

      {!group && detailError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription className="flex flex-col gap-2">
            <span>{groupErrorMessage(detailError, 'admin.groups.messages.error')}</span>
            <IamRuntimeDiagnosticDetails error={detailError} />
          </AlertDescription>
        </Alert>
      ) : null}

      {!group && !isLoading && !detailError ? (
        <Card className="p-5 text-sm text-muted-foreground" role="status">
          {t('admin.groups.detail.notFound')}
        </Card>
      ) : null}

      {formError ? (
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      {group ? (
        <>
          <GroupDetailEditForm state={state} />

          <GroupDetailMemberships state={state} />
        </>
      ) : null}

      {mutationError ? (
        <StudioPersistentFormError
          message={groupErrorMessage(mutationError, 'admin.groups.messages.error')}
          details={<IamRuntimeDiagnosticDetails error={mutationError} />}
        />
      ) : null}

      <ConfirmDialog
        open={canDeleteGroup && deleteConfirmOpen}
        title={t('admin.groups.confirm.deleteTitle')}
        description={t('admin.groups.confirm.deleteDescription')}
        confirmLabel={t('admin.groups.actions.delete')}
        cancelLabel={t('account.actions.cancel')}
        onConfirm={() => void onDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </section>
  );
};
