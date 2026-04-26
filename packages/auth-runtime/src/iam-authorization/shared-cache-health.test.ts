import { beforeEach, describe, expect, it } from 'vitest';

import {
  getPermissionCacheHealth,
  markPermissionCacheColdStart,
  permissionCacheRuntimeState,
  recordPermissionCacheRecompute,
  recordPermissionCacheRedisLatency,
} from './shared-cache-health.js';

const resetPermissionCacheRuntimeState = (): void => {
  permissionCacheRuntimeState.coldStartLogged = false;
  permissionCacheRuntimeState.lastRedisLatencyMs = 0;
  permissionCacheRuntimeState.consecutiveRedisFailures = 0;
  permissionCacheRuntimeState.recomputeTimestampsMs.splice(0);
};

describe('permission cache health', () => {
  beforeEach(() => {
    resetPermissionCacheRuntimeState();
  });

  it('reports cold-start ready status before the first cache lookup is logged', () => {
    expect(getPermissionCacheHealth(1_000)).toMatchObject({
      status: 'ready',
      coldStart: true,
      recomputePerMinute: 0,
      consecutiveRedisFailures: 0,
    });

    expect(markPermissionCacheColdStart()).toBe(true);
    expect(markPermissionCacheColdStart()).toBe(false);
    expect(getPermissionCacheHealth(1_000).coldStart).toBe(false);
  });

  it('reports degraded status for slow redis latency and resets consecutive failures after success', () => {
    recordPermissionCacheRedisLatency(75, false);
    recordPermissionCacheRedisLatency(20, true);

    expect(getPermissionCacheHealth(1_000)).toMatchObject({
      status: 'ready',
      lastRedisLatencyMs: 20,
      consecutiveRedisFailures: 0,
    });

    recordPermissionCacheRedisLatency(51, true);

    expect(getPermissionCacheHealth(1_000)).toMatchObject({
      status: 'degraded',
      lastRedisLatencyMs: 51,
    });
  });

  it('reports failed status after three consecutive redis failures', () => {
    recordPermissionCacheRedisLatency(10, false);
    recordPermissionCacheRedisLatency(11, false);
    recordPermissionCacheRedisLatency(12, false);

    expect(getPermissionCacheHealth(1_000)).toMatchObject({
      status: 'failed',
      consecutiveRedisFailures: 3,
    });
  });

  it('prunes recompute timestamps outside the sixty second window', () => {
    recordPermissionCacheRecompute(1_000);
    for (let index = 0; index < 21; index += 1) {
      recordPermissionCacheRecompute(61_000 + index);
    }

    expect(getPermissionCacheHealth(61_021)).toMatchObject({
      status: 'degraded',
      recomputePerMinute: 21,
    });

    expect(getPermissionCacheHealth(121_002)).toMatchObject({
      status: 'ready',
      recomputePerMinute: 19,
    });
    expect(permissionCacheRuntimeState.recomputeTimestampsMs[0]).toBe(61_002);
  });
});
