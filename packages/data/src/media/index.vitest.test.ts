import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data media compatibility', () => {
  it('re-exports the leading media repository factory', () => {
    expect(data.createMediaRepository).toBe(repos.createMediaRepository);
  });

  it('re-exports the leading media statements', () => {
    expect(data.mediaStatements).toBe(repos.mediaStatements);
  });
});
