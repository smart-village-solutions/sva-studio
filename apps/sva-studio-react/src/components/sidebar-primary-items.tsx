import {
  IconAppWindow,
  IconArticle,
  IconCategory,
  IconGauge,
  IconLayoutDashboard,
  IconPhoto,
  IconPlugConnected,
  IconPlus,
} from '@tabler/icons-react';
import { t } from '../i18n';
import {
  resolveContentRoutePrefix,
  updateContentTypeSearch,
} from '../lib/sidebar-content-navigation';
import {
  getStudioPluginAction,
  getStudioPluginNavigationModuleId,
  studioContentTypes,
  studioPluginNavigation,
} from '../lib/plugins';
import { resolveStudioContentTypeLabel } from '../lib/studio-content-types';
import {
  hasRequiredContentAccess,
  isModuleAssignedToUser,
  type SidebarAccess,
} from './sidebar-access';
import type { SidebarItem, SidebarLeafItem } from './sidebar-model';

const COCKPIT_URL = 'https://cockpit.guben.de';
const pluginIconBySection = {
  dataManagement: IconArticle,
  applications: IconAppWindow,
  system: IconPlugConnected,
} as const;

const resolvePluginNavigationItems = (access: SidebarAccess) => {
  const { user, brandingProfile, contentAccessApi, decideAccess } = access;
  const pluginNavigationItems = studioPluginNavigation
    .map((item) => {
      const action = item.actionId ? getStudioPluginAction(item.actionId) : undefined;
      return {
        item,
        resolvedTitleKey:
          item.id === 'ssf.tenant-navigation'
            ? brandingProfile.ssfTenantNavigationTitleKey
            : (action?.titleKey ?? item.titleKey),
        resolvedRequiredAction: action?.requiredAction ?? item.requiredAction,
        resolvedAccessRequirement: action?.accessRequirement ?? item.accessRequirement,
      };
    })
    .filter(({ resolvedAccessRequirement, resolvedRequiredAction }) =>
      resolvedAccessRequirement
        ? decideAccess(resolvedAccessRequirement).status === 'allowed'
        : hasRequiredContentAccess(
            resolvedRequiredAction,
            contentAccessApi.access
              ? {
                  ...contentAccessApi.access,
                  permissionActions: contentAccessApi.permissionActions,
                }
              : null,
            contentAccessApi.isLoading
          )
    )
    .map(({ item, resolvedTitleKey, resolvedAccessRequirement }) => ({
      kind: 'link' as const,
      id: `plugin-${item.id}`,
      to: item.to,
      label: t(resolvedTitleKey),
      icon: pluginIconBySection[item.section],
      section: item.section,
      moduleId: getStudioPluginNavigationModuleId(item),
      accessScope: resolvedAccessRequirement?.kind,
    }))
    .filter(
      (item) => item.accessScope === 'platform' || isModuleAssignedToUser(item.moduleId, user)
    );
  return pluginNavigationItems;
};

export const buildSidebarPrimaryItems = (access: SidebarAccess) => {
  const {
    user,
    brandingProfile,
    contentAccessApi,
    canAccessWorkspace,
    canAccessContent,
    canAccessMedia,
    canAccessCategories,
    canAccessApplicationLink,
    canAccessCockpitLink,
  } = access;
  const pluginNavigationItems = resolvePluginNavigationItems(access);
  const pluginDataManagementItems = pluginNavigationItems.filter(
    (item) => item.section === 'dataManagement'
  );
  const pluginApplicationItems = pluginNavigationItems.filter(
    (item) => item.section === 'applications'
  );
  const pluginSystemItems = pluginNavigationItems.filter((item) => item.section === 'system');
  const readableContentTypes = studioContentTypes.filter((definition) => {
    const moduleId = definition.requiredReadAction.startsWith('content.')
      ? null
      : definition.requiredReadAction.split('.')[0];
    return (
      contentAccessApi.permissionActions.includes(definition.requiredReadAction) &&
      isModuleAssignedToUser(moduleId, user)
    );
  });
  const creatableContentTypes = studioContentTypes.filter((definition) => {
    const moduleId = definition.requiredCreateAction.startsWith('content.')
      ? null
      : definition.requiredCreateAction.split('.')[0];
    return (
      contentAccessApi.permissionActions.includes(definition.requiredCreateAction) &&
      isModuleAssignedToUser(moduleId, user)
    );
  });
  const contentChildren: SidebarLeafItem[] = [
    ...(canAccessContent || readableContentTypes.length > 0
      ? [
          {
            kind: 'link' as const,
            id: 'content-all',
            to: '/admin/content',
            label: t('shell.sidebar.contentAll'),
            icon: IconArticle,
            exact: true,
            contentType: null,
            search: (current: Readonly<Record<string, unknown>>) =>
              updateContentTypeSearch(current, null),
          },
        ]
      : []),
    ...readableContentTypes.map((definition) => ({
      kind: 'link' as const,
      id: `content-type-${definition.contentType}`,
      to: '/admin/content',
      label: resolveStudioContentTypeLabel(definition),
      icon: IconArticle,
      exact: true,
      contentType: definition.contentType,
      activePathPrefixes: [
        resolveContentRoutePrefix(definition.createPath),
        resolveContentRoutePrefix(definition.detailPath),
      ],
      search: (current: Readonly<Record<string, unknown>>) =>
        updateContentTypeSearch(current, definition.contentType),
    })),
  ];

  const dataManagementItems: SidebarItem[] = [
    ...(brandingProfile.showContentNavigation &&
    canAccessWorkspace &&
    creatableContentTypes.length > 0
      ? [
          {
            kind: 'link' as const,
            id: 'create-content',
            to: '/admin/content/new',
            label: t('shell.sidebar.createContent'),
            icon: IconPlus,
            exact: true,
            appearance: 'primary' as const,
          },
        ]
      : []),
    {
      kind: 'link',
      id: 'overview',
      to: '/',
      label: t('shell.sidebar.overview'),
      icon: IconLayoutDashboard,
      exact: true,
    },
    ...(brandingProfile.showContentNavigation && canAccessWorkspace && contentChildren.length > 0
      ? [
          {
            kind: 'group' as const,
            id: 'content',
            label: t('shell.sidebar.content'),
            icon: IconArticle,
            children: contentChildren,
            activeChildStrategy: 'contentType' as const,
            knownContentTypes: studioContentTypes.map((definition) => definition.contentType),
          },
        ]
      : []),
    ...(canAccessCategories
      ? [
          {
            kind: 'link' as const,
            id: 'categories',
            to: '/categories',
            label: t('shell.sidebar.categories'),
            icon: IconCategory,
          },
        ]
      : []),
    ...(canAccessMedia
      ? [
          {
            kind: 'link' as const,
            id: 'media',
            to: '/admin/media',
            label: t('shell.sidebar.media'),
            icon: IconPhoto,
          },
        ]
      : []),
    ...pluginDataManagementItems,
  ];

  const applicationItems: SidebarItem[] = [
    ...(canAccessApplicationLink
      ? [
          {
            kind: 'link' as const,
            id: 'app',
            to: '/app',
            label: t('shell.sidebar.app'),
            icon: IconAppWindow,
          },
        ]
      : []),
    ...(canAccessCockpitLink
      ? [
          {
            kind: 'link' as const,
            id: 'cockpit',
            href: COCKPIT_URL,
            label: t('shell.sidebar.cockpit'),
            icon: IconGauge,
          },
        ]
      : []),
    ...pluginApplicationItems,
  ];

  return { dataManagementItems, applicationItems, pluginSystemItems };
};
