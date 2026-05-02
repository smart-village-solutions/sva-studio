import { describe, expect, it } from 'vitest';

import { appAdminResources } from './admin-resources';

describe('appAdminResources', () => {
  it('registers media as a host admin resource under /admin/media with module gating metadata', () => {
    expect(appAdminResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: 'host.media',
          basePath: 'media',
          moduleId: 'media',
          views: {
            list: { bindingKey: 'adminMedia' },
            create: { bindingKey: 'adminMedia' },
            detail: { bindingKey: 'adminMedia' },
          },
        }),
      ])
    );
  });
});
