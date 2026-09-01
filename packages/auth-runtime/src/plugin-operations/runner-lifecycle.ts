import type { StudioJobRecord } from '@sva/core';

import { readPluginTenantLifecycleJobMetadata } from '../plugin-tenant-lifecycle/job-correlation.js';

export const isConfiguredLifecycleJob = (job: StudioJobRecord): boolean => {
  if (job.source !== 'plugin' || !job.pluginId) {
    return false;
  }
  return readPluginTenantLifecycleJobMetadata(job) !== null;
};
