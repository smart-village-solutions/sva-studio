import type { StudioJobRecord } from '@sva/core';

import { isConfiguredPluginTenantLifecycleJobType } from '../plugin-tenant-lifecycle/access.js';
import { readPluginTenantLifecycleJobMetadata } from '../plugin-tenant-lifecycle/job-correlation.js';

export const isConfiguredLifecycleJob = (job: StudioJobRecord): boolean => {
  if (
    job.source !== 'plugin' ||
    !job.pluginId ||
    !isConfiguredPluginTenantLifecycleJobType(job.pluginId, job.jobTypeId)
  ) {
    return false;
  }
  return readPluginTenantLifecycleJobMetadata(job) !== null;
};
