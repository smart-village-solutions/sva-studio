import { describe, expect, it } from 'vitest';

import { studioBuildTimeRegistry } from './plugins.js';
import { studioModuleIamContracts, studioPluginModuleIamContracts } from '@sva/studio-module-iam';

describe('studio plugin registry contracts', () => {
  it('keeps build-time plugin module contracts aligned with the shared runtime contract source', () => {
    expect(studioPluginModuleIamContracts).toEqual(studioBuildTimeRegistry.pluginModuleIamContracts);
    expect(studioModuleIamContracts.map((contract) => contract.moduleId)).toEqual(['news', 'events', 'poi', 'media']);
  });
});
