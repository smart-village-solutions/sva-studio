import { describe, expect, it } from 'vitest';

import { pluginSdkPackageRoles, pluginSdkVersion } from './index.js';

describe('@sva/plugin-sdk package scaffold', () => {
  it('declares the target package role', () => {
    expect(pluginSdkVersion).toBe('0.0.1');
    expect(pluginSdkPackageRoles).toContain('plugin-contracts');
  });
});
