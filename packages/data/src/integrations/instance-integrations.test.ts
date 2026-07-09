import { describe, expect, it } from 'vitest';

import * as data from './instance-integrations.js';
import * as repos from '@sva/data-repositories';

describe('instance integration boundary', () => {
  it('re-exports the leading instance integration repository factory', () => {
    expect(data.createInstanceIntegrationRepository).toBe(repos.createInstanceIntegrationRepository);
  });

  it('re-exports the leading cached loader and statements', () => {
    expect(data.createCachedInstanceIntegrationLoader).toBe(repos.createCachedInstanceIntegrationLoader);
    expect(data.instanceIntegrationStatements).toBe(repos.instanceIntegrationStatements);
  });
});
