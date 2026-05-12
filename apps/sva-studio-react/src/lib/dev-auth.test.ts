import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isDevAuthAvailable } from './dev-auth';

describe('dev-auth helpers', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SVA_DEV_AUTH', 'false');
    vi.stubEnv('VITE_MOCK_AUTH', 'false');
    vi.stubEnv('VITE_SVA_RUNTIME_PROFILE', '');
  });

  it('enables dev auth through explicit env flags', () => {
    vi.stubEnv('VITE_SVA_DEV_AUTH', 'true');
    expect(isDevAuthAvailable()).toBe(true);

    vi.stubEnv('VITE_SVA_DEV_AUTH', 'false');
    vi.stubEnv('VITE_MOCK_AUTH', 'true');
    expect(isDevAuthAvailable()).toBe(true);
  });

  it('enables dev auth through mock-auth runtime profiles', () => {
    vi.stubEnv('VITE_SVA_RUNTIME_PROFILE', 'local-builder');

    expect(isDevAuthAvailable()).toBe(true);
  });
});
