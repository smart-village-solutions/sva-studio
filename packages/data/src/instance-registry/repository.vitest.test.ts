import { describe, expect, it } from 'vitest';

import * as data from '../index.js';
import * as repos from '@sva/data-repositories';

describe('@sva/data instance registry repository compatibility', () => {
  it('re-exports the leading instance registry repository factory from the package root', () => {
    expect(data.createInstanceRegistryRepository).toBe(repos.createInstanceRegistryRepository);
  });
});
