import { describe, expect, it } from 'vitest';

import vitestConfig from '../../vitest.config';

describe('root vitest config', () => {
  it('excludes nested worktrees from root-level test discovery', () => {
    expect(vitestConfig.test?.exclude).toEqual(expect.arrayContaining(['.worktrees/**']));
  });
});
