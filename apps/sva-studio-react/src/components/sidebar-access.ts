import React from 'react';
import { summarizeContentAccess } from '@sva/core';
import type { EffectiveAccessSnapshot, UiAccessRequirement } from '@sva/plugin-sdk';
import { useContentAccess } from '../hooks/use-content-access';
import { useOrganizationContext } from '../hooks/use-organization-context';
import {
  hasExperimentalAccess,
  hasIamGovernanceAccess,
  hasInterfacesAccess,
  hasLegalTextAdminAccess,
  hasMonitoringAccess,
  hasOrganizationAdminAccess,
  hasPlatformInstanceAdminAccess,
  hasRoleAdminAccess,
  hasUserAdminAccess,
  isIamAdminEnabled,
  isIamUiEnabled,
} from '../lib/iam-admin-access';
import { useAuth } from '../providers/auth-provider';
import type { MePermissionsResponse } from '../providers/effective-access-permissions';
import { evaluateUiAccess, useEffectiveAccess } from '../providers/effective-access-provider';
import { useStudioBranding } from '../providers/studio-branding-provider';

export type DocumentNavigation = Readonly<{
  user: Pick<
    NonNullable<ReturnType<typeof useAuth>['user']>,
    'id' | 'instanceId' | 'instanceDisplayName' | 'roles' | 'assignedModules'
  >;
  organizationId: string | null;
  permissions: MePermissionsResponse['permissions'];
}>;

const resolveDocumentSidebarAccess = (navigation: DocumentNavigation) => {
  const { user, organizationId, permissions } = navigation;
  const snapshot: EffectiveAccessSnapshot = user.instanceId
    ? {
        status: 'ready',
        generation: 0,
        scope: {
          kind: 'tenant',
          instanceId: user.instanceId,
          organizationId,
          authGeneration: 0,
          moduleAssignmentGeneration: 0,
        },
        assignedModules: user.assignedModules ?? [],
        permissions,
      }
    : {
        status: 'ready',
        generation: 0,
        scope: { kind: 'platform', authGeneration: 0 },
        platformRoles: user.roles,
      };
  return {
    user,
    isAuthenticated: true,
    contentAccessApi: {
      access: user.instanceId ? summarizeContentAccess(permissions) : null,
      permissionActions: [...new Set(permissions.map(({ action }) => action))],
      unscopedPermissionActions: [],
      isLoading: false,
      error: null,
    },
    decideAccess: (requirement: UiAccessRequirement) =>
      evaluateUiAccess({ isAuthenticated: true, requirement, snapshot }),
  };
};

const useDocumentSidebarAccess = (
  initialNavigation: DocumentNavigation | undefined,
  contentAccess: ReturnType<typeof useContentAccess>
) => {
  const auth = useAuth();
  const organization = useOrganizationContext();
  const [navigation, setNavigation] = React.useState(
    auth.isLoading && !auth.hasResolvedSession ? initialNavigation : undefined
  );
  const verifyingSession = auth.isLoading && !auth.hasResolvedSession;
  const sameIdentity =
    auth.user?.id === navigation?.user.id && auth.user?.instanceId === navigation?.user.instanceId;
  const verifyingOrganization = organization.isLoading && !organization.context;
  const sameOrganization =
    (organization.context?.activeOrganizationId ?? null) === navigation?.organizationId;
  const showInitialNavigation =
    navigation &&
    !auth.error &&
    !auth.isRecoveringSession &&
    !organization.error &&
    !organization.isUpdating &&
    (verifyingSession ||
      (sameIdentity && (verifyingOrganization || (sameOrganization && contentAccess.isLoading))));

  React.useEffect(() => {
    if (!showInitialNavigation && navigation) setNavigation(undefined);
  }, [showInitialNavigation, navigation]);

  return React.useMemo(
    () => showInitialNavigation ? resolveDocumentSidebarAccess(navigation) : undefined,
    [showInitialNavigation, navigation]
  );
};

const COCKPIT_LINK_PERMISSION = 'cockpit.read';
const MODULES_READ_PERMISSION = 'modules.read';
const CATEGORIES_READ_PERMISSION = 'categories.read';

export const hasRequiredContentAccess = (
  requiredAction: string | undefined,
  access:
    | {
        readonly canRead?: boolean;
        readonly canCreate?: boolean;
        readonly canUpdate?: boolean;
        readonly permissionActions?: readonly string[];
      }
    | null
    | undefined,
  isLoading: boolean
) => {
  if (!requiredAction) {
    return true;
  }

  if (isLoading) {
    return false;
  }

  if (!access) {
    return false;
  }

  if (!requiredAction.startsWith('content.')) {
    return access.permissionActions?.includes(requiredAction) === true;
  }

  switch (requiredAction) {
    case 'content.read':
      return access.canRead === true;
    case 'content.create':
      return access.canCreate === true;
    case 'content.updateMetadata':
    case 'content.updatePayload':
    case 'content.changeStatus':
    case 'content.publish':
    case 'content.archive':
    case 'content.restore':
    case 'content.readHistory':
    case 'content.manageRevisions':
    case 'content.delete':
      return false;
    default:
      return false;
  }
};

const hasPermissionAction = (
  requiredAction: string,
  permissionActions: readonly string[] | undefined,
  isLoading: boolean
) => {
  if (isLoading) {
    return false;
  }

  return permissionActions?.includes(requiredAction) === true;
};

export const isModuleAssignedToUser = (
  moduleId: string | null | undefined,
  user: { assignedModules?: readonly string[] } | null | undefined
) => {
  if (!moduleId) {
    return true;
  }

  return user?.assignedModules?.includes(moduleId) === true;
};

type SidebarAccessInputs = {
  user: ReturnType<typeof useAuth>['user'];
  accessUser: ReturnType<typeof useAuth>['user'];
  isAuthenticated: boolean;
  brandingProfile: ReturnType<typeof useStudioBranding>['profile'];
  contentAccessApi: ReturnType<typeof useContentAccess>;
};

const resolveSidebarAdminAccess = ({
  user,
  accessUser,
  isAuthenticated,
  contentAccessApi,
}: SidebarAccessInputs) => {
  const canAccessAdminUsers =
    isAuthenticated &&
    isIamAdminEnabled() &&
    (hasUserAdminAccess(accessUser) || hasPlatformInstanceAdminAccess(accessUser));
  const canAccessAdminOrganizations =
    isAuthenticated && isIamAdminEnabled() && hasOrganizationAdminAccess(accessUser);
  const canAccessAdminInstances =
    isAuthenticated && isIamAdminEnabled() && hasPlatformInstanceAdminAccess(accessUser);
  const canAccessTenantLoginMfa =
    isAuthenticated &&
    isIamAdminEnabled() &&
    Boolean(user?.instanceId) &&
    hasPermissionAction(
      'iam.authenticationPolicy.manage',
      contentAccessApi.permissionActions,
      contentAccessApi.isLoading
    );
  const canAccessTenantInvitationTemplate =
    isAuthenticated &&
    isIamAdminEnabled() &&
    Boolean(user?.instanceId) &&
    hasPermissionAction(
      'iam.invitationTemplate.manage',
      contentAccessApi.permissionActions,
      contentAccessApi.isLoading
    );
  const canAccessAdminRoles =
    isAuthenticated &&
    isIamAdminEnabled() &&
    (hasRoleAdminAccess(accessUser) || hasPlatformInstanceAdminAccess(accessUser));
  const canAccessAdminGroups = canAccessAdminRoles && Boolean(user?.instanceId);
  const canAccessAdminLegalTexts =
    isAuthenticated && isIamAdminEnabled() && hasLegalTextAdminAccess(accessUser);
  const canAccessAdminPrivacy =
    isAuthenticated && isIamAdminEnabled() && hasIamGovernanceAccess(accessUser);
  return {
    canAccessAdminUsers,
    canAccessAdminOrganizations,
    canAccessAdminInstances,
    canAccessTenantLoginMfa,
    canAccessTenantInvitationTemplate,
    canAccessAdminRoles,
    canAccessAdminGroups,
    canAccessAdminLegalTexts,
    canAccessAdminPrivacy,
  };
};

const resolveSidebarSystemAccess = ({
  user,
  accessUser,
  isAuthenticated,
  brandingProfile,
  contentAccessApi,
}: SidebarAccessInputs) => {
  const canAccessInterfaces =
    brandingProfile.showInterfacesNavigation &&
    isAuthenticated &&
    isIamUiEnabled() &&
    hasInterfacesAccess(accessUser);
  const canAccessExperimentalFeatures =
    isAuthenticated && isIamUiEnabled() && hasExperimentalAccess(accessUser);
  const canAccessSystemTools =
    canAccessExperimentalFeatures &&
    isAuthenticated &&
    isIamUiEnabled() &&
    hasMonitoringAccess(accessUser);
  const canAccessModules =
    brandingProfile.showModulesNavigation &&
    isAuthenticated &&
    isIamUiEnabled() &&
    (hasPlatformInstanceAdminAccess(accessUser) ||
      (Boolean(user?.instanceId) &&
        hasPermissionAction(
          MODULES_READ_PERMISSION,
          contentAccessApi.permissionActions,
          contentAccessApi.isLoading
        )) ||
      (Boolean(user?.instanceId) &&
        user?.assignedModules?.includes('application-workspace') &&
        hasPermissionAction(
          'application-workspace.settings.read',
          contentAccessApi.permissionActions,
          contentAccessApi.isLoading
        )));
  return {
    canAccessInterfaces,
    canAccessExperimentalFeatures,
    canAccessSystemTools,
    canAccessModules,
    canAccessAppTexts:
      isAuthenticated &&
      Boolean(user?.instanceId) &&
      isModuleAssignedToUser('app', user) &&
      hasPermissionAction(
        'app-texts.catalog.read',
        contentAccessApi.permissionActions,
        contentAccessApi.isLoading
      ),
  };
};

export const useSidebarAccess = (initialNavigation?: DocumentNavigation) => {
  const auth = useAuth();
  const { profile: brandingProfile } = useStudioBranding();
  const contentAccess = useContentAccess();
  const effectiveAccess = useEffectiveAccess();
  const initial = useDocumentSidebarAccess(initialNavigation, contentAccess);
  const { user, isAuthenticated, contentAccessApi, decideAccess } = initial ?? {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    contentAccessApi: contentAccess,
    decideAccess: effectiveAccess.decide,
  };
  const accessUser = user
    ? { ...user, permissionActions: contentAccessApi.permissionActions }
    : user;
  const canAccessWorkspace = isAuthenticated && isIamUiEnabled();
  const canAccessContent = canAccessWorkspace && contentAccessApi.access?.canRead === true;
  const canAccessMedia =
    canAccessWorkspace &&
    isModuleAssignedToUser('media', user) &&
    hasPermissionAction(
      'media.read',
      contentAccessApi.permissionActions,
      contentAccessApi.isLoading
    );
  const canAccessCategories =
    canAccessWorkspace &&
    isModuleAssignedToUser('categories', user) &&
    hasPermissionAction(
      CATEGORIES_READ_PERMISSION,
      contentAccessApi.permissionActions,
      contentAccessApi.isLoading
    );
  const inputs = { user, accessUser, isAuthenticated, brandingProfile, contentAccessApi };
  const adminAccess = resolveSidebarAdminAccess(inputs);
  const systemAccess = resolveSidebarSystemAccess(inputs);
  const { canAccessExperimentalFeatures } = systemAccess;
  const canAccessCockpitLink =
    canAccessWorkspace &&
    canAccessExperimentalFeatures &&
    hasPermissionAction(
      COCKPIT_LINK_PERMISSION,
      contentAccessApi.permissionActions,
      contentAccessApi.isLoading
    );

  return {
    user,
    brandingProfile,
    contentAccessApi,
    decideAccess,
    canAccessWorkspace,
    canAccessContent,
    canAccessMedia,
    canAccessCategories,
    ...adminAccess,
    ...systemAccess,
    canAccessCockpitLink,
  };
};

export type SidebarAccess = ReturnType<typeof useSidebarAccess>;
