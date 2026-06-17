import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data plugin operation compatibility', () => {
  it('re-exports the leading studio job repository factory', () => {
    expect(data.createStudioJobRepository).toBe(repos.createStudioJobRepository);
  });
});
