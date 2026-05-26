import { describe, expect, it } from 'vitest';

import {
  buildAuthorizeBenchmarkPayload,
  renderAuthorizePerformanceMarkdownReport,
  summarizeDurations,
  type AuthorizePerformanceReport,
} from './iam-authorize-performance.ts';

describe('iam-authorize-performance helpers', () => {
  it('summarizeDurations computes p50, p95 and p99 from unsorted samples', () => {
    const summary = summarizeDurations([12, 4, 30, 8, 16]);

    expect(summary).toEqual({
      count: 5,
      minMs: 4,
      maxMs: 30,
      avgMs: 14,
      p50Ms: 12,
      p95Ms: 30,
      p99Ms: 30,
    });
  });

  it('buildAuthorizeBenchmarkPayload keeps stable cache keys for hit/recompute and rotates geo context for miss', () => {
    const basePayload = {
      instanceId: 'de-musterhausen',
      action: 'content.read',
      resource: {
        type: 'content',
        id: 'article-1',
        organizationId: 'org-1',
      },
      context: {
        organizationId: 'org-1',
      },
    };

    const cacheHitA = buildAuthorizeBenchmarkPayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 0,
      scenario: 'cache-hit',
    });
    const cacheHitB = buildAuthorizeBenchmarkPayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 1,
      scenario: 'cache-hit',
    });
    const recompute = buildAuthorizeBenchmarkPayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 2,
      scenario: 'recompute',
    });
    const missA = buildAuthorizeBenchmarkPayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 0,
      scenario: 'cache-miss',
    });
    const missB = buildAuthorizeBenchmarkPayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 1,
      scenario: 'cache-miss',
    });

    expect(cacheHitA.context?.geoHierarchy).toBeUndefined();
    expect(cacheHitB.context?.geoHierarchy).toBeUndefined();
    expect(recompute.context?.geoHierarchy).toBeUndefined();
    expect(missA.context?.geoHierarchy).not.toEqual(missB.context?.geoHierarchy);
    expect(missA.context?.geoHierarchy).toHaveLength(1);
    expect(missB.context?.geoHierarchy).toHaveLength(1);
    expect(missA.context?.geoHierarchy).not.toEqual(missB.context?.geoHierarchy);
    expect(missA.context?.geoHierarchy?.[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(missB.context?.geoHierarchy?.[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('renderAuthorizePerformanceMarkdownReport includes scenario summaries and acceptance verdict', () => {
    const report: AuthorizePerformanceReport = {
      generatedAt: '2026-05-25T17:30:00.000Z',
      target: {
        baseUrl: 'http://127.0.0.1:3000',
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      configuration: {
        concurrency: 100,
        measuredRequests: 50,
        warmupRequests: 5,
      },
      scenarios: [
        {
          scenario: 'cache-hit',
          samplesMs: [10, 12, 14],
          summary: summarizeDurations([10, 12, 14]),
          accepted: true,
        },
        {
          scenario: 'cache-miss',
          samplesMs: [40, 55, 65],
          summary: summarizeDurations([40, 55, 65]),
          accepted: true,
        },
        {
          scenario: 'recompute',
          samplesMs: [80, 90, 120],
          summary: summarizeDurations([80, 90, 120]),
          accepted: false,
        },
      ],
    };

    const markdown = renderAuthorizePerformanceMarkdownReport(report);

    expect(markdown).toMatch(/# Performance-Nachweis IAM Authorize/);
    expect(markdown).toMatch(/Cache-Hit/);
    expect(markdown).toMatch(/Cache-Miss/);
    expect(markdown).toMatch(/Recompute/);
    expect(markdown).toMatch(/nicht erfüllt/);
    expect(markdown).toMatch(/p95 < 100 ms im Cache-Hit-Szenario: erfüllt/);
  });
});
