import { describe, expect, it } from 'vitest';
import { resolvesSystemAdminGrant } from '@sva/core';

import {
  getStudioModuleIamContract,
  studioHostModuleIamContracts,
  studioModuleIamContracts,
  studioModuleIamRegistry,
  studioPermissionCatalog,
  studioPluginModuleIamContracts,
} from './index.js';

describe('@sva/studio-module-iam', () => {
  it('publishes the canonical studio module contracts and registry', () => {
    expect(studioPluginModuleIamContracts.map((contract) => contract.moduleId)).toEqual([
      'categories',
      'news',
      'events',
      'poi',
      'generic-items',
      'faq',
      'cockpit-cards',
      'projects',
      'surveys',
      'waste-management',
    ]);
    expect(studioHostModuleIamContracts.map((contract) => contract.moduleId)).toEqual([
      'media',
      'app',
    ]);
    expect(studioModuleIamContracts.map((contract) => contract.moduleId)).toEqual([
      'categories',
      'news',
      'events',
      'poi',
      'generic-items',
      'faq',
      'cockpit-cards',
      'projects',
      'surveys',
      'waste-management',
      'media',
      'app',
    ]);
    expect(studioModuleIamRegistry.get('app')).toMatchObject({
      ownerPluginId: 'host',
      permissionIds: [],
    });
    expect(studioModuleIamRegistry.get('media')).toMatchObject({
      ownerPluginId: 'host',
      permissionIds: [
        'media.read',
        'media.create',
        'media.update',
        'media.reference.manage',
        'media.delete',
        'media.deliver.protected',
      ],
    });
    expect(studioModuleIamRegistry.get('waste-management')).toMatchObject({
      ownerPluginId: 'waste-management',
      permissionIds: [
        'waste-management.email-reminder-monitoring.read',
        'waste-management.read',
        'waste-management.master-data.manage',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
        'waste-management.import.execute',
        'waste-management.export.execute',
        'waste-management.seed.execute',
        'waste-management.reset.execute',
        'waste-management.settings.manage',
      ],
    });
    expect(studioModuleIamRegistry.has('ssf')).toBe(false);
  });

  it('publishes one validated view of core and module permissions', () => {
    expect(
      studioPermissionCatalog.find((permission) => permission.key === 'iam.accounts.delete')
    ).toMatchObject({
      availability: { kind: 'tenant' },
    });
    expect(
      studioPermissionCatalog.find((permission) => permission.key === 'media.delete')
    ).toMatchObject({
      availability: { kind: 'module', moduleId: 'media' },
    });
    expect(new Set(studioPermissionCatalog.map((permission) => permission.key)).size).toBe(
      studioPermissionCatalog.length
    );
  });

  it('grants the complete tenant catalog, including waste email monitoring, to system_admin', () => {
    expect(studioPermissionCatalog.map(({ key }) => key)).toContain(
      'waste-management.email-reminder-monitoring.read'
    );
    for (const permission of studioPermissionCatalog) {
      expect(resolvesSystemAdminGrant(permission), permission.key).toBe(
        permission.availability.kind !== 'root'
      );
    }
    for (const contract of studioModuleIamContracts) {
      const admin = contract.systemRoles?.find(({ roleName }) => roleName === 'system_admin');
      expect(new Set(admin?.permissionIds), contract.moduleId).toEqual(new Set(contract.permissionIds));
    }
  });

  it('exposes normalized standard-content contracts for plugin modules', () => {
    expect(getStudioModuleIamContract('categories')).toMatchObject({
      moduleId: 'categories',
      namespace: 'categories',
      ownerPluginId: 'categories',
      permissionIds: [
        'categories.read',
        'categories.create',
        'categories.update',
        'categories.delete',
      ],
      tenantBootstrapRoles: [
        {
          roleName: 'system_admin',
          permissionIds: [
            'categories.read',
            'categories.create',
            'categories.update',
            'categories.delete',
          ],
        },
      ],
    });
    expect(getStudioModuleIamContract('news')).toMatchObject({
      moduleId: 'news',
      namespace: 'news',
      ownerPluginId: 'news',
      permissionIds: [
        'news.read',
        'news.create',
        'news.update',
        'news.delete',
        'news.pushNotification',
      ],
      tenantBootstrapRoles: [
        {
          roleName: 'system_admin',
          permissionIds: [
            'news.read',
            'news.create',
            'news.update',
            'news.delete',
            'news.pushNotification',
          ],
        },
      ],
    });
    expect(
      getStudioModuleIamContract('events')?.tenantBootstrapRoles.map((role) => role.roleName)
    ).toEqual(['system_admin']);
    expect(
      getStudioModuleIamContract('poi')?.tenantBootstrapRoles.map((role) => role.roleName)
    ).toEqual(['system_admin']);
    expect(getStudioModuleIamContract('poi')?.systemRoles).toEqual([
      {
        roleName: 'system_admin',
        permissionIds: ['poi.read', 'poi.create', 'poi.update', 'poi.delete'],
      },
    ]);
    expect(getStudioModuleIamContract('generic-items')).toMatchObject({
      moduleId: 'generic-items',
      namespace: 'generic-items',
      ownerPluginId: 'generic-items',
      permissionIds: [
        'generic-items.read',
        'generic-items.create',
        'generic-items.update',
        'generic-items.delete',
      ],
      tenantBootstrapRoles: [
        {
          roleName: 'system_admin',
          permissionIds: [
            'generic-items.read',
            'generic-items.create',
            'generic-items.update',
            'generic-items.delete',
          ],
        },
      ],
    });
    expect(getStudioModuleIamContract('faq')).toMatchObject({
      moduleId: 'faq',
      namespace: 'faq',
      ownerPluginId: 'faq',
      permissionIds: ['faq.read', 'faq.create', 'faq.update', 'faq.delete'],
    });
    expect(getStudioModuleIamContract('cockpit-cards')).toMatchObject({
      moduleId: 'cockpit-cards',
      namespace: 'cockpit-cards',
      ownerPluginId: 'cockpit-cards',
      permissionIds: [
        'cockpit-cards.read',
        'cockpit-cards.create',
        'cockpit-cards.update',
        'cockpit-cards.delete',
      ],
    });
    expect(getStudioModuleIamContract('projects')).toMatchObject({
      moduleId: 'projects',
      namespace: 'projects',
      ownerPluginId: 'projects',
      permissionIds: ['projects.read', 'projects.create', 'projects.update', 'projects.delete'],
      tenantBootstrapRoles: [
        {
          roleName: 'system_admin',
          permissionIds: ['projects.read', 'projects.create', 'projects.update', 'projects.delete'],
        },
      ],
    });
    expect(getStudioModuleIamContract('surveys')).toMatchObject({
      moduleId: 'surveys',
      namespace: 'surveys',
      ownerPluginId: 'surveys',
      permissionIds: [
        'surveys.read',
        'surveys.create',
        'surveys.update',
        'surveys.delete',
        'surveys.moderate',
        'surveys.export',
      ],
      tenantBootstrapRoles: [
        {
          roleName: 'system_admin',
          permissionIds: [
            'surveys.read',
            'surveys.create',
            'surveys.update',
            'surveys.delete',
            'surveys.moderate',
            'surveys.export',
          ],
        },
      ],
    });
    expect(getStudioModuleIamContract('waste-management')).toMatchObject({
      moduleId: 'waste-management',
      namespace: 'waste-management',
      ownerPluginId: 'waste-management',
      rootSystemRoles: [],
    });
    expect(getStudioModuleIamContract('waste-management')?.tenantBootstrapRoles).toEqual([
      {
        roleName: 'system_admin',
        permissionIds: [
          'waste-management.email-reminder-monitoring.read',
          'waste-management.read',
          'waste-management.master-data.manage',
          'waste-management.tours.manage',
          'waste-management.scheduling.manage',
          'waste-management.import.execute',
          'waste-management.export.execute',
          'waste-management.seed.execute',
          'waste-management.reset.execute',
          'waste-management.settings.manage',
        ],
      },
    ]);
  });
});
