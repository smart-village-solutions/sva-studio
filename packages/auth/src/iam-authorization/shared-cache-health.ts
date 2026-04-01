const CACHE_RECOMPUTE_WINDOW_MS = 60_000;
const CACHE_DEGRADED_LATENCY_MS = 50;
const CACHE_DEGRADED_RECOMPUTE_THRESHOLD = 20;
const CACHE_FAILED_REDIS_FAILURE_THRESHOLD = 3;

export const cacheMetricsState = { lookups: 0, staleLookups: 0 };

export const permissionCacheRuntimeState = {
  coldStartLogged: false,
  lastRedisLatencyMs: 0,
  consecutiveRedisFailures: 0,
  recomputeTimestampsMs: [] as number[],
};

const pruneRecomputeTimestamps = (nowMs: number): void => {
  permissionCacheRuntimeState.recomputeTimestampsMs =
    permissionCacheRuntimeState.recomputeTimestampsMs.filter(
      (timestamp) => nowMs - timestamp <= CACHE_RECOMPUTE_WINDOW_MS
    );
};

export const recordPermissionCacheColdStart = (
  buildContext: (workspaceId?: string) => Record<string, unknown>,
  log: (message: string, attributes: Record<string, unknown>) => void,
  instanceId: string
): void => {
  if (permissionCacheRuntimeState.coldStartLogged) {
    return;
  }

  permissionCacheRuntimeState.coldStartLogged = true;
  log('Permission cache cold start detected', {
    operation: 'cache_lookup',
    cache_cold_start: true,
    ...buildContext(instanceId),
  });
};

export const recordPermissionCacheRedisLatency = (latencyMs: number, available: boolean): void => {
  permissionCacheRuntimeState.lastRedisLatencyMs = latencyMs;
  permissionCacheRuntimeState.consecutiveRedisFailures = available
    ? 0
    : permissionCacheRuntimeState.consecutiveRedisFailures + 1;
};

export const recordPermissionCacheRecompute = (nowMs = Date.now()): void => {
  pruneRecomputeTimestamps(nowMs);
  permissionCacheRuntimeState.recomputeTimestampsMs.push(nowMs);
};

export const getPermissionCacheHealth = (nowMs = Date.now()) => {
  pruneRecomputeTimestamps(nowMs);
  const recomputePerMinute = permissionCacheRuntimeState.recomputeTimestampsMs.length;
  const hasFailedRedis =
    permissionCacheRuntimeState.consecutiveRedisFailures >= CACHE_FAILED_REDIS_FAILURE_THRESHOLD;
  const hasDegradedLatency = permissionCacheRuntimeState.lastRedisLatencyMs > CACHE_DEGRADED_LATENCY_MS;
  const hasFrequentRecomputes = recomputePerMinute > CACHE_DEGRADED_RECOMPUTE_THRESHOLD;

  let status: 'failed' | 'degraded' | 'ready' = 'ready';
  if (hasFailedRedis) {
    status = 'failed';
  } else if (hasDegradedLatency || hasFrequentRecomputes) {
    status = 'degraded';
  }

  return {
    status,
    coldStart: !permissionCacheRuntimeState.coldStartLogged,
    lastRedisLatencyMs: permissionCacheRuntimeState.lastRedisLatencyMs,
    recomputePerMinute,
    consecutiveRedisFailures: permissionCacheRuntimeState.consecutiveRedisFailures,
  } as const;
};
