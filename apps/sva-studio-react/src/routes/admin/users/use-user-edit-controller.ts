import React from 'react';

import { useGroups } from '../../../hooks/use-groups';
import { useOrganizations } from '../../../hooks/use-organizations';
import { useRoles } from '../../../hooks/use-roles';
import { useUser } from '../../../hooks/use-user';
import { getUserTimeline } from '../../../lib/iam-api';
import {
  USER_EDIT_TABS,
  buildGroupMembershipById,
  hasUserFormChanges,
  splitPermissionTrace,
  toUserFormValues,
  toUserUpdatePayload,
  type UserEditTabKey,
  type UserFormValues,
} from './user-edit-model';
import { selectAssignableGroups, selectAssignableRoles } from './user-assignment-options';

type UserEditControllerOptions = {
  readonly userId: string;
};

type OrganizationMembershipDraft = {
  readonly visibility: 'internal' | 'external';
  readonly isDefaultContext: boolean;
};

const DEFAULT_ORGANIZATION_ASSIGNMENT = {
  organizationId: '',
  isDefaultContext: false,
};

const buildOrganizationMembershipDrafts = (user: ReturnType<typeof useUser>['user']) =>
  Object.fromEntries(
    (user?.organizationMemberships ?? []).map((membership) => [
      membership.organizationId,
      {
        visibility: membership.visibility,
        isDefaultContext: membership.isDefaultContext,
      } satisfies OrganizationMembershipDraft,
    ])
  ) as Record<string, OrganizationMembershipDraft>;

const useUserEditFormState = (user: ReturnType<typeof useUser>['user']) => {
  const [formValues, setFormValues] = React.useState<UserFormValues>(() => toUserFormValues(user));
  const baselineFormValues = React.useMemo(() => toUserFormValues(user), [user]);
  const hasUnsavedChanges = React.useMemo(
    () => hasUserFormChanges(baselineFormValues, formValues),
    [baselineFormValues, formValues]
  );

  React.useEffect(() => {
    if (!user) {
      return;
    }

    setFormValues(toUserFormValues(user));
  }, [user]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  return {
    formValues,
    hasUnsavedChanges,
    setFormValues,
  };
};

const useUserTimelineState = (activeTab: UserEditTabKey, userId: string) => {
  const [timeline, setTimeline] = React.useState<Awaited<ReturnType<typeof getUserTimeline>>['data']>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = React.useState(false);
  const [timelineError, setTimelineError] = React.useState<string | null>(null);
  const [hasLoadedTimeline, setHasLoadedTimeline] = React.useState(false);

  React.useEffect(() => {
    setTimeline([]);
    setTimelineError(null);
    setHasLoadedTimeline(false);
  }, [userId]);

  React.useEffect(() => {
    if (activeTab !== 'history' || hasLoadedTimeline) {
      return;
    }

    let active = true;
    setIsLoadingTimeline(true);
    setTimelineError(null);

    void getUserTimeline(userId)
      .then((response) => {
        if (!active) {
          return;
        }
        setTimeline(response.data);
        setHasLoadedTimeline(true);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setTimeline([]);
        setTimelineError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) {
          setIsLoadingTimeline(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeTab, hasLoadedTimeline, userId]);

  const reloadTimeline = React.useCallback(async () => {
    setIsLoadingTimeline(true);
    setTimelineError(null);

    try {
      const response = await getUserTimeline(userId);
      setTimeline(response.data);
      setHasLoadedTimeline(true);
    } catch (error) {
      setTimeline([]);
      setTimelineError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [userId]);

  return {
    isLoadingTimeline,
    reloadTimeline,
    timeline,
    timelineError,
  };
};

const useUserEditTabState = (hasUnsavedChanges: boolean) => {
  const [activeTab, setActiveTab] = React.useState<UserEditTabKey>('personal');
  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false);
  const [pendingTab, setPendingTab] = React.useState<UserEditTabKey | null>(null);

  const onTabIntent = React.useCallback(
    (nextTab: UserEditTabKey) => {
      if (nextTab === activeTab) {
        return;
      }

      if (hasUnsavedChanges && activeTab !== 'personal') {
        setPendingTab(nextTab);
        setUnsavedDialogOpen(true);
        return;
      }

      setActiveTab(nextTab);
    },
    [activeTab, hasUnsavedChanges]
  );

  const onTabKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, tabIndex: number) => {
      const key = event.key;
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) {
        return;
      }

      event.preventDefault();
      if (key === 'Home') {
        onTabIntent(USER_EDIT_TABS[0].key);
        return;
      }

      if (key === 'End') {
        onTabIntent(USER_EDIT_TABS[USER_EDIT_TABS.length - 1].key);
        return;
      }

      const direction = key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (tabIndex + direction + USER_EDIT_TABS.length) % USER_EDIT_TABS.length;
      onTabIntent(USER_EDIT_TABS[nextIndex].key);
    },
    [onTabIntent]
  );

  return {
    activeTab,
    onTabIntent,
    onTabKeyDown,
    pendingTab,
    setActiveTab,
    setPendingTab,
    setUnsavedDialogOpen,
    unsavedDialogOpen,
  };
};

const useUserSaveActions = (
  userApi: ReturnType<typeof useUser>,
  formValues: UserFormValues,
  setFormValues: React.Dispatch<React.SetStateAction<UserFormValues>>
) => {
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSendingPasswordSetupEmail, setIsSendingPasswordSetupEmail] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [passwordSetupEmailSuccess, setPasswordSetupEmailSuccess] = React.useState(false);

  const onSave = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setIsSaving(true);
      setSaveSuccess(false);
      setPasswordSetupEmailSuccess(false);

      const result = await userApi.save(toUserUpdatePayload(formValues));
      if (result) {
        setFormValues(toUserFormValues(result));
        setSaveSuccess(true);
      }

      setIsSaving(false);
    },
    [formValues, setFormValues, userApi]
  );

  const onSendPasswordSetupEmail = React.useCallback(async () => {
    if (!userApi.resendPasswordSetupEmail || isSendingPasswordSetupEmail) {
      return;
    }

    setIsSendingPasswordSetupEmail(true);
    setSaveSuccess(false);
    setPasswordSetupEmailSuccess(false);

    const sent = await userApi.resendPasswordSetupEmail();
    if (sent) {
      setPasswordSetupEmailSuccess(true);
    }

    setIsSendingPasswordSetupEmail(false);
  }, [isSendingPasswordSetupEmail, userApi]);

  return {
    isSaving,
    isSendingPasswordSetupEmail,
    onSave,
    onSendPasswordSetupEmail,
    passwordSetupEmailSuccess,
    saveSuccess,
  };
};

const useUserOrganizationMembershipState = (input: {
  readonly userId: string;
  readonly user: ReturnType<typeof useUser>['user'];
  readonly refetchUser: () => Promise<void>;
}) => {
  const organizationsApi = useOrganizations({ page: 1, pageSize: 100, status: 'active' });
  const [organizationAssignment, setOrganizationAssignment] = React.useState(DEFAULT_ORGANIZATION_ASSIGNMENT);
  const [organizationMembershipDrafts, setOrganizationMembershipDrafts] = React.useState<
    Record<string, OrganizationMembershipDraft>
  >(() => buildOrganizationMembershipDrafts(input.user));

  React.useEffect(() => {
    setOrganizationMembershipDrafts(buildOrganizationMembershipDrafts(input.user));
  }, [input.user]);

  const assignedOrganizationIds = React.useMemo(
    () => new Set((input.user?.organizationMemberships ?? []).map((membership) => membership.organizationId)),
    [input.user?.organizationMemberships]
  );
  const availableOrganizations = React.useMemo(
    () => organizationsApi.organizations.filter((organization) => !assignedOrganizationIds.has(organization.id)),
    [assignedOrganizationIds, organizationsApi.organizations]
  );

  const updateOrganizationMembershipDraft = React.useCallback(
    (organizationId: string, patch: Partial<OrganizationMembershipDraft>) => {
      setOrganizationMembershipDrafts((current) => ({
        ...current,
        [organizationId]: {
          visibility: patch.visibility ?? current[organizationId]?.visibility ?? 'internal',
          isDefaultContext: patch.isDefaultContext ?? current[organizationId]?.isDefaultContext ?? false,
        },
      }));
    },
    []
  );

  const assignOrganizationMembership = React.useCallback(async () => {
    if (!organizationAssignment.organizationId) {
      return false;
    }

    const updated = await organizationsApi.assignMembership(organizationAssignment.organizationId, {
      accountId: input.userId,
      visibility: 'internal',
      isDefaultContext: organizationAssignment.isDefaultContext,
    });
    if (!updated) {
      return false;
    }

    setOrganizationAssignment(DEFAULT_ORGANIZATION_ASSIGNMENT);
    await input.refetchUser();
    return true;
  }, [input, organizationAssignment, organizationsApi]);

  const saveOrganizationMembership = React.useCallback(
    async (organizationId: string) => {
      const draft = organizationMembershipDrafts[organizationId];
      if (!draft) {
        return false;
      }

      const updated = await organizationsApi.updateMembership(organizationId, input.userId, draft);
      if (!updated) {
        return false;
      }

      await input.refetchUser();
      return true;
    },
    [input, organizationMembershipDrafts, organizationsApi]
  );

  const removeOrganizationMembership = React.useCallback(
    async (organizationId: string) => {
      const updated = await organizationsApi.removeMembership(organizationId, input.userId);
      if (!updated) {
        return false;
      }

      await input.refetchUser();
      return true;
    },
    [input, organizationsApi]
  );

  return {
    availableOrganizations,
    organizationAssignment,
    organizationMembershipDrafts,
    organizationMutationError: organizationsApi.mutationError,
    assignOrganizationMembership,
    removeOrganizationMembership,
    saveOrganizationMembership,
    setOrganizationAssignment,
    updateOrganizationMembershipDraft,
  };
};

export const useUserEditController = ({ userId }: UserEditControllerOptions) => {
  const userApi = useUser(userId);
  const rolesApi = useRoles();
  const groupsApi = useGroups();

  const selectableRoles = React.useMemo(() => selectAssignableRoles(rolesApi.roles), [rolesApi.roles]);
  const selectableGroups = React.useMemo(() => selectAssignableGroups(groupsApi.groups), [groupsApi.groups]);

  const { formValues, hasUnsavedChanges, setFormValues } = useUserEditFormState(userApi.user);
  const {
    activeTab,
    onTabIntent,
    onTabKeyDown,
    pendingTab,
    setActiveTab,
    setPendingTab,
    setUnsavedDialogOpen,
    unsavedDialogOpen,
  } = useUserEditTabState(hasUnsavedChanges);
  const { isLoadingTimeline, reloadTimeline, timeline, timelineError } = useUserTimelineState(activeTab, userId);
  const {
    isSaving,
    isSendingPasswordSetupEmail,
    onSave,
    onSendPasswordSetupEmail,
    passwordSetupEmailSuccess,
    saveSuccess,
  } = useUserSaveActions(userApi, formValues, setFormValues);
  const { effective: effectivePermissionTrace, inactive: inactivePermissionTrace } = React.useMemo(
    () => splitPermissionTrace(userApi.user?.permissionTrace),
    [userApi.user?.permissionTrace]
  );
  const groupMembershipById = React.useMemo(
    () => buildGroupMembershipById(userApi.user?.groups),
    [userApi.user?.groups]
  );
  const {
    availableOrganizations,
    organizationAssignment,
    organizationMembershipDrafts,
    organizationMutationError,
    assignOrganizationMembership,
    removeOrganizationMembership,
    saveOrganizationMembership,
    setOrganizationAssignment,
    updateOrganizationMembershipDraft,
  } = useUserOrganizationMembershipState({
    userId,
    user: userApi.user,
    refetchUser: userApi.refetch,
  });

  const resetFormValues = React.useCallback(() => {
    setFormValues(toUserFormValues(userApi.user));
  }, [setFormValues, userApi.user]);

  const retryUserLoad = React.useCallback(() => {
    userApi.clearMutationError();
    void userApi.refetch();
  }, [userApi]);

  const closeUnsavedDialog = React.useCallback(() => {
    setUnsavedDialogOpen(false);
    setPendingTab(null);
  }, [setPendingTab, setUnsavedDialogOpen]);

  const confirmPendingTab = React.useCallback(() => {
    if (pendingTab) {
      setActiveTab(pendingTab);
    }
    setUnsavedDialogOpen(false);
    setPendingTab(null);
    setFormValues(toUserFormValues(userApi.user));
  }, [pendingTab, setActiveTab, setFormValues, setPendingTab, setUnsavedDialogOpen, userApi.user]);

  return {
    activeTab,
    closeUnsavedDialog,
    confirmPendingTab,
    effectivePermissionTrace,
    formValues,
    groupMembershipById,
    groupsApi,
    hasUnsavedChanges,
    inactivePermissionTrace,
    isLoadingTimeline,
    isSaving,
    isSendingPasswordSetupEmail,
    onSave,
    organizationAssignment,
    organizationMembershipDrafts,
    organizationMutationError,
    assignOrganizationMembership,
    onSendPasswordSetupEmail,
    onTabIntent,
    onTabKeyDown,
    passwordSetupEmailSuccess,
    reloadTimeline,
    removeOrganizationMembership,
    resetFormValues,
    retryUserLoad,
    rolesApi,
    saveOrganizationMembership,
    saveSuccess,
    availableOrganizations,
    selectableGroups,
    selectableRoles,
    setFormValues,
    setOrganizationAssignment,
    timeline,
    timelineError,
    unsavedDialogOpen,
    updateOrganizationMembershipDraft,
    userApi,
  };
};
