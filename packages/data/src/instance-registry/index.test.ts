import assert from 'node:assert/strict';
import { describe, it } from 'vitest';

import {
  createInstanceRegistryRepository as createLeadingInstanceRegistryRepository,
  type InstanceRegistryRepository as LeadingInstanceRegistryRepository,
} from '@sva/data-repositories';

import {
  createInstanceRegistryRepository,
  type InstanceRegistryRepository,
} from './index';

describe('instance registry repository boundary', () => {
  it('re-exports the leading repository factory from @sva/data-repositories', () => {
    assert.equal(createInstanceRegistryRepository, createLeadingInstanceRegistryRepository);
  });

  it('keeps the local repository types aligned with @sva/data-repositories', () => {
    type AssertAssignable<T extends U, U> = true;

    const repositoryTypeAligned: AssertAssignable<InstanceRegistryRepository, LeadingInstanceRegistryRepository> = true;
    const repositoryTypeAlignedReverse: AssertAssignable<LeadingInstanceRegistryRepository, InstanceRegistryRepository> = true;

    assert.equal(repositoryTypeAligned, true);
    assert.equal(repositoryTypeAlignedReverse, true);
  });
});
