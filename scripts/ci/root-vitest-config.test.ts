import { configDefaults } from 'vitest/config';
import { describe, expect, it } from 'vitest';

import vitestConfig from '../../vitest.config';

describe('root vitest config', () => {
  it('extends Vitest defaults while excluding nested worktrees from root-level test discovery', () => {
    expect(vitestConfig.test?.exclude).toEqual(expect.arrayContaining(configDefaults.exclude));
    expect(vitestConfig.test?.exclude).toEqual(expect.arrayContaining(['.worktrees/**']));
  });
});
