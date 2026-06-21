import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import * as data from './repositories.js';
import * as repos from '@sva/data-repositories';

describe('iam repository boundary', () => {
  it('re-exports the leading IAM seed repository factory', () => {
    assert.equal(data.createIamSeedRepository, repos.createIamSeedRepository);
  });

  it('re-exports the leading IAM seed statements', () => {
    assert.equal(data.iamSeedStatements, repos.iamSeedStatements);
  });
});
