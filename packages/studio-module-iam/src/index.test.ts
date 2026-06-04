import { describe, expect, it } from 'vitest';

import {
  getStudioModuleIamContract,
  studioHostModuleIamContracts,
  studioModuleIamContracts,
  studioModuleIamRegistry,
  studioPluginModuleIamContracts,
} from './index.js';

describe('@sva/studio-module-iam', () => {
  it('publishes the canonical studio module contracts and registry', () => {
    expect(studioPluginModuleIamContracts.map((contract) => contract.moduleId)).toEqual([
      'news',
      'events',
      'poi',
      'waste-management',
    ]);
    expect(studioHostModuleIamContracts.map((contract) => contract.moduleId)).toEqual(['media']);
    expect(studioModuleIamContracts.map((contract) => contract.moduleId)).toEqual([
      'news',
      'events',
      'poi',
      'waste-management',
      'media',
    ]);
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
        'waste-management.read',
        'waste-management.master-data.manage',
        'waste-management.tours.manage',
        'waste-management.scheduling.manage',
        'waste-management.import.execute',
        'waste-management.seed.execute',
        'waste-management.reset.execute',
        'waste-management.settings.manage',
      ],
    });
  });

  it('exposes normalized standard-content contracts for plugin modules', () => {
    expect(getStudioModuleIamContract('news')).toMatchObject({
      moduleId: 'news',
      namespace: 'news',
      ownerPluginId: 'news',
      permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
    });
    expect(getStudioModuleIamContract('events')?.tenantBootstrapRoles.map((role) => role.roleName)).toContain(
      'system_admin'
    );
    expect(getStudioModuleIamContract('events')?.tenantBootstrapRoles.map((role) => role.roleName)).not.toContain(
      'app_manager'
    );
    expect(getStudioModuleIamContract('poi')?.tenantBootstrapRoles.map((role) => role.roleName)).toContain('editor');
    expect(getStudioModuleIamContract('waste-management')).toMatchObject({
      moduleId: 'waste-management',
      namespace: 'waste-management',
      ownerPluginId: 'waste-management',
      rootSystemRoles: [],
    });
    expect(getStudioModuleIamContract('waste-management')?.tenantBootstrapRoles.map((role) => role.roleName)).not.toContain(
      'app_manager'
    );
  });
});
