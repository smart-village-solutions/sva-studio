import { describe, expect, it } from 'vitest';

import {
  pluginProjects,
  pluginProjectsActionDefinitions,
  pluginProjectsPermissionDefinitions,
} from '../src/plugin.js';

describe('projects plugin contract', () => {
  it('registers an independent hidden-navigation content resource', () => {
    expect(pluginProjects.id).toBe('projects');
    expect(pluginProjects.displayName).toBe('Projekte');
    expect(pluginProjects.navigation).toEqual([]);
    expect(pluginProjects.actions).toEqual(pluginProjectsActionDefinitions);
    expect(pluginProjects.permissions).toEqual(pluginProjectsPermissionDefinitions);
    expect(pluginProjects.permissions?.map((permission) => permission.id)).toEqual([
      'projects.read',
      'projects.create',
      'projects.update',
      'projects.delete',
    ]);
    expect(pluginProjects.adminResources).toEqual([
      expect.objectContaining({
        resourceId: 'projects.content',
        contentUi: {
          contentType: 'projects.project',
          bindings: {
            list: { bindingKey: 'projectsList' },
            detail: { bindingKey: 'projectsDetail' },
            editor: { bindingKey: 'projectsEditor' },
          },
        },
      }),
    ]);
  });
});
