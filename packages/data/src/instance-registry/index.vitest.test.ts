import {
  createInstanceRegistryRepository as createLeadingInstanceRegistryRepository,
  type InstanceRegistryRepository as LeadingInstanceRegistryRepository,
} from '@sva/data-repositories';
import { describe, expect, it } from 'vitest';

import {
  createInstanceRegistryRepository,
  type InstanceRegistryRepository,
} from './index';

describe('instance registry repository boundary (vitest)', () => {
  it('re-exports the leading repository factory from @sva/data-repositories', () => {
    expect(createInstanceRegistryRepository).toBe(createLeadingInstanceRegistryRepository);
  });

  it('keeps the local repository types aligned with @sva/data-repositories', () => {
    type AssertAssignable<T extends U, U> = true;

    const repositoryTypeAligned: AssertAssignable<InstanceRegistryRepository, LeadingInstanceRegistryRepository> = true;
    const repositoryTypeAlignedReverse: AssertAssignable<LeadingInstanceRegistryRepository, InstanceRegistryRepository> = true;

    expect(repositoryTypeAligned).toBe(true);
    expect(repositoryTypeAlignedReverse).toBe(true);
  });
});
