import { describe, expect, it } from 'vitest';

import {
  buildPermissionCacheProbePayload,
  parsePermissionCacheMultiReplicaConfig,
  percentile,
  renderPermissionCacheMultiReplicaReport,
} from './iam-permission-cache-multi-replica.ts';

describe('IAM permission-cache multi-replica helpers', () => {
  it('requires two replicas and both failure targets', () => {
    expect(() =>
      parsePermissionCacheMultiReplicaConfig({
        IAM_CACHE_REPLICA_URLS: 'http://127.0.0.1:3102',
      })
    ).toThrowError('iam_cache_replica_urls_requires_two_replicas');

    expect(() =>
      parsePermissionCacheMultiReplicaConfig({
        IAM_CACHE_REPLICA_URLS: 'http://127.0.0.1:3102,http://127.0.0.1:3103',
      })
    ).toThrowError('iam_cache_multi_replica_config_missing');
  });

  it('normalizes a complete local configuration', () => {
    expect(
      parsePermissionCacheMultiReplicaConfig({
        IAM_CACHE_REPLICA_URLS: 'http://127.0.0.1:3102/, http://127.0.0.1:3103',
        IAM_CACHE_REDIS_FAILURE_URL: 'http://127.0.0.1:3104/',
        IAM_CACHE_DATABASE_FAILURE_URL: 'http://127.0.0.1:3105/',
        IAM_CACHE_TEST_DATABASE_URL: 'postgres://local/test',
        IAM_CACHE_TEST_REDIS_URL: 'redis://local:6379',
        IAM_CACHE_TEST_MEASURED_REQUESTS: '25',
      })
    ).toMatchObject({
      replicaUrls: ['http://127.0.0.1:3102', 'http://127.0.0.1:3103'],
      redisFailureUrl: 'http://127.0.0.1:3104',
      databaseFailureUrl: 'http://127.0.0.1:3105',
      measuredRequests: 25,
    });
  });

  it('uses the nearest-rank p95 and renders acceptance evidence', () => {
    const samples = Array.from({ length: 100 }, (_, index) => index + 1);
    expect(percentile(samples, 0.5)).toBe(50);
    expect(percentile(samples, 0.95)).toBe(95);
    expect(percentile(samples, 0.99)).toBe(99);

    const markdown = renderPermissionCacheMultiReplicaReport({
      generatedAt: '2026-08-16T10:00:00.000Z',
      replicaCount: 2,
      measuredRequests: 100,
      scenarios: [{ name: 'Grant', status: 'passed', details: 'beide Replikate aktuell' }],
      benchmarks: [
        {
          scenario: 'cache-hit',
          samplesMs: [2, 3, 4],
          p50Ms: 3,
          p95Ms: 4,
          p99Ms: 4,
          thresholdMs: 250,
          accepted: true,
        },
      ],
    });

    expect(markdown).toContain('App-Replikate: 2');
    expect(markdown).toContain('| Grant | erfüllt |');
    expect(markdown).toContain(
      '| cache-hit | 3 | 3.00 ms | 4.00 ms | 4.00 ms | < 250.00 ms | erfüllt |'
    );
    expect(markdown).toContain('Produktionsbuild, lokales Docker-Netz');
    expect(markdown).toContain('Alle Multi-Replikat- und Performance-Kriterien sind erfüllt.');
  });

  it('places geo hierarchy in the canonical authorize context attributes', () => {
    expect(
      buildPermissionCacheProbePayload({
        instanceId: 'de-musterhausen',
        action: 'content.cacheProbe',
        resourceType: 'acceptance',
        geoHierarchy: ['00000000-0000-4000-8000-000000000001'],
      })
    ).toEqual({
      instanceId: 'de-musterhausen',
      action: 'content.cacheProbe',
      resource: { type: 'acceptance' },
      context: {
        attributes: {
          geoHierarchy: ['00000000-0000-4000-8000-000000000001'],
        },
      },
    });
  });
});
