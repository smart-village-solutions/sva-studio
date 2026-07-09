import { describe, expect, it } from 'vitest';

import * as data from './repositories.js';
import * as repos from '@sva/data-repositories';

describe('iam repository boundary', () => {
  it('re-exports the leading IAM seed repository factory', () => {
    expect(data.createIamSeedRepository).toBe(repos.createIamSeedRepository);
  });

  it('re-exports the leading IAM seed statements', () => {
    expect(data.iamSeedStatements).toBe(repos.iamSeedStatements);
  });
});
