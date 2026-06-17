import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as local from './instance-integrations.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data instance integration compatibility', () => {
  it('re-exports the leading integration repository factory from the package root', () => {
    expect(data.createInstanceIntegrationRepository).toBe(repos.createInstanceIntegrationRepository);
  });

  it('re-exports the leading cached loader and statements from the local compatibility module', () => {
    expect(local.createCachedInstanceIntegrationLoader).toBe(repos.createCachedInstanceIntegrationLoader);
    expect(local.instanceIntegrationStatements).toBe(repos.instanceIntegrationStatements);
    expect(local.DEFAULT_INSTANCE_INTEGRATION_CACHE_TTL_MS).toBe(repos.DEFAULT_INSTANCE_INTEGRATION_CACHE_TTL_MS);
  });
});
