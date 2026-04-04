import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildPermissionCacheColdStartLog,
  cacheMetricsState,
  getPermissionCacheHealth,
  markPermissionCacheColdStart,
  permissionCacheRuntimeState,
  recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency,
} from './shared-cache-health.js';

describe('shared-cache-health', () => {
  beforeEach(() => {
    cacheMetricsState.lookups = 0;
    cacheMetricsState.staleLookups = 0;
    permissionCacheRuntimeState.coldStartLogged = false;
    permissionCacheRuntimeState.lastRedisLatencyMs = 0;
    permissionCacheRuntimeState.consecutiveRedisFailures = 0;
    permissionCacheRuntimeState.recomputeTimestampsMs = [];
  });

  it('marks cold start only once and builds a cold-start log context', () => {
    expect(markPermissionCacheColdStart()).toBe(true);
    expect(markPermissionCacheColdStart()).toBe(false);
    expect(buildPermissionCacheColdStartLog('de-musterhausen')).toEqual({
      message: 'Permission cache cold start detected',
      attributes: expect.objectContaining({
        operation: 'cache_lookup',
        cache_cold_start: true,
        workspace_id: 'de-musterhausen',
      }),
    });
  });

  it('reports degraded and failed cache health from runtime state', () => {
    recordPermissionCacheRedisLatency(80, true);
    for (let index = 0; index < 21; index += 1) {
      recordPermissionCacheRecompute(1_000 + index);
    }

    expect(getPermissionCacheHealth(61_000)).toEqual({
      status: 'degraded',
      coldStart: true,
      lastRedisLatencyMs: 80,
      recomputePerMinute: 21,
      consecutiveRedisFailures: 0,
    });

    recordPermissionCacheRedisLatency(10, false);
    recordPermissionCacheRedisLatency(10, false);
    recordPermissionCacheRedisLatency(10, false);

    expect(getPermissionCacheHealth(61_000).status).toBe('failed');
  });
});
