import {
  IconActivityHeartbeat,
  IconBuildingCommunity,
  IconFileText,
  IconHierarchy3,
  IconPackages,
  IconPlugConnected,
  IconShieldCheck,
  IconShieldLock,
  IconTemplate,
  IconUserSquareRounded,
  IconUsersGroup,
} from '@tabler/icons-react';
import { t } from '../i18n';
import type { SidebarAccess } from './sidebar-access';
import type { SidebarItem, SidebarLeafItem } from './sidebar-model';

export const buildSidebarSystemItems = (
  access: SidebarAccess,
  pluginSystemItems: readonly SidebarItem[]
): SidebarItem[] => {
  const {
    canAccessAdminUsers,
    canAccessTenantInvitationTemplate,
    canAccessAdminOrganizations,
    canAccessAdminInstances,
    canAccessAdminRoles,
    canAccessAdminGroups,
    canAccessAdminLegalTexts,
    canAccessAdminPrivacy,
    canAccessInterfaces,
    canAccessModules,
    canAccessSystemTools,
  } = access;
  const userChildren: SidebarLeafItem[] = [
    ...(canAccessAdminUsers
      ? [
          {
            kind: 'link' as const,
            id: 'accounts',
            to: '/admin/users',
            label: t('shell.sidebar.accounts'),
            icon: IconUserSquareRounded,
          },
        ]
      : []),
    ...(canAccessTenantInvitationTemplate
      ? [
          {
            kind: 'link' as const,
            id: 'invitation-template',
            to: '/admin/users/invitation-template',
            label: t('shell.sidebar.invitationTemplate'),
            icon: IconTemplate,
          },
        ]
      : []),
    ...(canAccessAdminOrganizations
      ? [
          {
            kind: 'link' as const,
            id: 'organizations',
            to: '/admin/organizations',
            label: t('shell.sidebar.organizations'),
            icon: IconBuildingCommunity,
          },
        ]
      : []),
    ...(canAccessAdminInstances
      ? [
          {
            kind: 'link' as const,
            id: 'instances',
            to: '/admin/instances',
            label: t('shell.sidebar.instances'),
            icon: IconHierarchy3,
          },
        ]
      : []),
    ...(canAccessAdminRoles
      ? [
          {
            kind: 'link' as const,
            id: 'roles',
            to: '/admin/roles',
            label: t('shell.sidebar.roles'),
            icon: IconShieldLock,
          },
          ...(canAccessAdminGroups
            ? [
                {
                  kind: 'link' as const,
                  id: 'groups',
                  to: '/admin/groups',
                  label: t('shell.sidebar.groups'),
                  icon: IconUsersGroup,
                },
              ]
            : []),
        ]
      : []),
    ...(canAccessAdminLegalTexts
      ? [
          {
            kind: 'link' as const,
            id: 'legal-texts',
            to: '/admin/legal-texts',
            label: t('shell.sidebar.legalTexts'),
            icon: IconFileText,
          },
        ]
      : []),
    ...(canAccessAdminPrivacy
      ? [
          {
            kind: 'link' as const,
            id: 'privacy',
            to: '/admin/iam',
            label: t('shell.sidebar.privacy'),
            icon: IconShieldCheck,
          },
        ]
      : []),
  ];

  const systemItems: SidebarItem[] = [
    ...(userChildren.length > 0
      ? [
          {
            kind: 'group' as const,
            id: 'users',
            label: t('shell.sidebar.users'),
            icon: IconUsersGroup,
            children: userChildren,
          },
        ]
      : []),
    ...(canAccessInterfaces
      ? [
          {
            kind: 'link' as const,
            id: 'interfaces',
            to: '/interfaces',
            label: t('shell.sidebar.interfaces'),
            icon: IconPlugConnected,
          },
        ]
      : []),
    ...(canAccessAdminInstances
      ? [
          {
            kind: 'link' as const,
            id: 'templates',
            to: '/admin/templates',
            label: t('shell.sidebar.templates'),
            icon: IconTemplate,
          },
        ]
      : []),
    ...(canAccessModules
      ? [
          {
            kind: 'link' as const,
            id: 'modules',
            to: '/modules',
            label: t('shell.sidebar.modules'),
            icon: IconPackages,
          },
        ]
      : []),
    ...(canAccessSystemTools
      ? [
          {
            kind: 'link' as const,
            id: 'monitoring',
            to: '/monitoring',
            label: t('shell.sidebar.monitoring'),
            icon: IconActivityHeartbeat,
          },
          ...pluginSystemItems,
        ]
      : [...pluginSystemItems]),
  ];

  return systemItems;
};
