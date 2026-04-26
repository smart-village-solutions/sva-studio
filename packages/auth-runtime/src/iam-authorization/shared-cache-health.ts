import { buildLogContext } from '../log-context.js';

const CACHE_RECOMPUTE_WINDOW_MS = 60_000;
const CACHE_DEGRADED_LATENCY_MS = 50;
const CACHE_DEGRADED_RECOMPUTE_THRESHOLD = 20;
const CACHE_FAILED_REDIS_FAILURE_THRESHOLD = 3;

const buildRequestContext = (workspaceId?: string) => buildLogContext(workspaceId, { includeTraceId: true });

export const cacheMetricsState = { lookups: 0, staleLookups: 0 };

export const permissionCacheRuntimeState = {
  coldStartLogged: false,
  lastRedisLatencyMs: 0,
  consecutiveRedisFailures: 0,
  recomputeTimestampsMs: [] as number[],
};

const pruneRecomputeTimestamps = (nowMs: number): void => {
  const recomputeTimestampsMs = permissionCacheRuntimeState.recomputeTimestampsMs;
  const cutoffMs = nowMs - CACHE_RECOMPUTE_WINDOW_MS;
  let firstValidIndex = 0;

  while (
    firstValidIndex < recomputeTimestampsMs.length
    && recomputeTimestampsMs[firstValidIndex]! < cutoffMs
  ) {
    firstValidIndex += 1;
  }

  if (firstValidIndex > 0) {
    recomputeTimestampsMs.splice(0, firstValidIndex);
  }
};

export const markPermissionCacheColdStart = (): boolean => {
  if (permissionCacheRuntimeState.coldStartLogged) {
    return false;
  }

  permissionCacheRuntimeState.coldStartLogged = true;
  return true;
};

export const buildPermissionCacheColdStartLog = (workspaceId: string) => ({
  message: 'Permission cache cold start detected',
  attributes: {
    operation: 'cache_lookup',
    cache_cold_start: true,
    ...buildRequestContext(workspaceId),
  },
});

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
