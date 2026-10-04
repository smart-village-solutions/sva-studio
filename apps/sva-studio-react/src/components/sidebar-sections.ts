import React from 'react';
import { t } from '../i18n';
import type { SidebarAccess } from './sidebar-access';
import type { SidebarSection } from './sidebar-model';
import { buildSidebarPrimaryItems } from './sidebar-primary-items';
import { buildSidebarSystemItems } from './sidebar-system-items';

export const useSidebarSections = (access: SidebarAccess): readonly SidebarSection[] =>
  React.useMemo<readonly SidebarSection[]>(() => {
    const { dataManagementItems, applicationItems, pluginSystemItems } =
      buildSidebarPrimaryItems(access);
    const systemItems = buildSidebarSystemItems(access, pluginSystemItems);
    return [
      {
        id: 'data-management',
        label: t('shell.sidebar.sections.dataManagement'),
        items: dataManagementItems,
      },
      ...(applicationItems.length > 0
        ? [
            {
              id: 'applications',
              label: t('shell.sidebar.sections.applications'),
              items: applicationItems,
            },
          ]
        : []),
      ...(systemItems.length > 0
        ? [
            {
              id: 'system',
              label: t('shell.sidebar.sections.system'),
              items: systemItems,
            },
          ]
        : []),
    ];
  }, [
    access.canAccessAdminOrganizations,
    access.canAccessAdminInstances,
    access.canAccessAdminLegalTexts,
    access.canAccessAdminPrivacy,
    access.canAccessAdminRoles,
    access.canAccessAdminUsers,
    access.canAccessTenantInvitationTemplate,
    access.canAccessApplicationLink,
    access.canAccessCockpitLink,
    access.canAccessInterfaces,
    access.canAccessMedia,
    access.canAccessModules,
    access.canAccessSystemTools,
    access.canAccessWorkspace,
    access.canAccessContent,
    access.brandingProfile.showContentNavigation,
    access.brandingProfile.ssfTenantNavigationTitleKey,
    access.contentAccessApi.access,
    access.contentAccessApi.isLoading,
    access.contentAccessApi.permissionActions,
    access.decideAccess,
    access.user,
  ]);
