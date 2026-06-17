import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as data from './instance-integrations.js';
import * as repos from '@sva/data-repositories';

describe('instance integration boundary', () => {
  it('re-exports the leading instance integration repository factory', () => {
    assert.equal(data.createInstanceIntegrationRepository, repos.createInstanceIntegrationRepository);
  });

  it('re-exports the leading cached loader and statements', () => {
    assert.equal(data.createCachedInstanceIntegrationLoader, repos.createCachedInstanceIntegrationLoader);
    assert.equal(data.instanceIntegrationStatements, repos.instanceIntegrationStatements);
  });
});
