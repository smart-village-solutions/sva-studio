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
    expect(studioPluginModuleIamContracts.map((contract) => contract.moduleId)).toEqual(['news', 'events', 'poi']);
    expect(studioHostModuleIamContracts.map((contract) => contract.moduleId)).toEqual(['media']);
    expect(studioModuleIamContracts.map((contract) => contract.moduleId)).toEqual(['news', 'events', 'poi', 'media']);
    expect(studioModuleIamRegistry.get('media')).toMatchObject({
      ownerPluginId: 'host',
      permissionIds: ['media.read', 'media.create', 'media.update', 'media.referenceManage', 'media.delete', 'media.deliverProtected'],
    });
  });

  it('exposes normalized standard-content contracts for plugin modules', () => {
    expect(getStudioModuleIamContract('news')).toMatchObject({
      moduleId: 'news',
      namespace: 'news',
      ownerPluginId: 'news',
      permissionIds: ['news.read', 'news.create', 'news.update', 'news.delete'],
    });
    expect(getStudioModuleIamContract('events')?.systemRoles.map((role) => role.roleName)).toContain('system_admin');
    expect(getStudioModuleIamContract('poi')?.systemRoles.map((role) => role.roleName)).toContain('editor');
  });
});
