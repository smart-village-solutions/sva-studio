import { useContentAccess } from '../hooks/use-content-access';
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
import { useEffectiveAccess } from '../providers/effective-access-provider';
import { useStudioBranding } from '../providers/studio-branding-provider';

export const APP_LINK_PERMISSION = 'app.read';
export const COCKPIT_LINK_PERMISSION = 'cockpit.read';
export const MODULES_READ_PERMISSION = 'modules.read';
export const CATEGORIES_READ_PERMISSION = 'categories.read';

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

export const hasPermissionAction = (
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
        )));
  return {
    canAccessInterfaces,
    canAccessExperimentalFeatures,
    canAccessSystemTools,
    canAccessModules,
  };
};

export const useSidebarAccess = () => {
  const { user, isAuthenticated } = useAuth();
  const { profile: brandingProfile } = useStudioBranding();
  const contentAccessApi = useContentAccess();
  const { decide: decideAccess } = useEffectiveAccess();
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
  const canAccessApplicationLink =
    brandingProfile.showGenericApplicationLinks &&
    canAccessWorkspace &&
    canAccessExperimentalFeatures &&
    hasPermissionAction(
      APP_LINK_PERMISSION,
      contentAccessApi.permissionActions,
      contentAccessApi.isLoading
    );
  const canAccessCockpitLink =
    brandingProfile.showGenericApplicationLinks &&
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
    canAccessApplicationLink,
    canAccessCockpitLink,
  };
};

export type SidebarAccess = ReturnType<typeof useSidebarAccess>;
