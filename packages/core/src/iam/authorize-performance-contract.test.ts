import { describe, expect, it } from 'vitest';

import {
  buildAuthorizePerformancePayload,
  renderAuthorizePerformanceMarkdownReport,
  summarizeAuthorizePerformanceDurations,
  type AuthorizePerformanceRunResult,
} from './authorize-performance-contract.js';

describe('authorize-performance-contract helpers', () => {
  it('returns a zeroed summary for empty samples', () => {
    expect(summarizeAuthorizePerformanceDurations([])).toEqual({
      count: 0,
      minMs: 0,
      maxMs: 0,
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
    });
  });

  it('summarizes p50, p95 and p99 from unsorted samples', () => {
    const summary = summarizeAuthorizePerformanceDurations([12, 4, 30, 8, 16]);

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

  it('keeps stable cache keys for hit and recompute while rotating geo context for miss', () => {
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

    const cacheHitA = buildAuthorizePerformancePayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 0,
      scenario: 'cache-hit',
    });
    const cacheHitB = buildAuthorizePerformancePayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 1,
      scenario: 'cache-hit',
    });
    const recompute = buildAuthorizePerformancePayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 2,
      scenario: 'recompute',
    });
    const missA = buildAuthorizePerformancePayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 0,
      scenario: 'cache-miss',
    });
    const missB = buildAuthorizePerformancePayload({
      basePayload,
      runId: 'run-1',
      sampleIndex: 1,
      scenario: 'cache-miss',
    });

    expect(cacheHitA.context?.attributes?.geoHierarchy).toBeUndefined();
    expect(cacheHitB.context?.attributes?.geoHierarchy).toBeUndefined();
    expect(recompute.context?.attributes?.geoHierarchy).toBeUndefined();
    expect(missA.context?.attributes?.geoHierarchy).not.toEqual(missB.context?.attributes?.geoHierarchy);
    expect(missA.context?.attributes?.geoHierarchy).toHaveLength(1);
    expect(missB.context?.attributes?.geoHierarchy).toHaveLength(1);
    expect(missA.context?.attributes?.geoHierarchy).not.toEqual(missB.context?.attributes?.geoHierarchy);
    expect(missA.context?.attributes?.geoHierarchy?.[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(missB.context?.attributes?.geoHierarchy?.[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it('creates cache-miss payloads even when the base payload has no context yet', () => {
    const payload = buildAuthorizePerformancePayload({
      basePayload: {
        instanceId: 'de-musterhausen',
        action: 'content.read',
        resource: {
          type: 'content',
        },
      },
      runId: 'run-2',
      sampleIndex: 3,
      scenario: 'cache-miss',
    });

    expect(payload.context?.requestId).toBe('bench-run-2-cache-miss-3');
    expect(payload.context?.attributes?.geoHierarchy).toHaveLength(1);
  });

  it('renders markdown with scenario summaries, report paths and verdicts', () => {
    const report: AuthorizePerformanceRunResult = {
      generatedAt: '2026-05-25T17:30:00.000Z',
      measuredOn: 'server',
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-1',
      },
      request: {
        action: 'content.read',
        resourceType: 'content',
        resourceId: 'article-1',
        organizationId: 'org-1',
      },
      configuration: {
        measuredRequests: 50,
        warmupRequests: 5,
      },
      report: {
        jsonPath: 'docs/reports/iam-authorize-performance-2026-05-25.json',
        markdownPath: 'docs/reports/iam-authorize-performance-2026-05-25.md',
      },
      scenarios: [
        {
          scenario: 'cache-hit',
          samplesMs: [10, 12, 14],
          summary: summarizeAuthorizePerformanceDurations([10, 12, 14]),
          evaluation: 'accepted',
          evaluationLabel: 'erfüllt',
          observedCacheStatuses: ['hit', 'hit', 'hit'],
        },
        {
          scenario: 'cache-miss',
          samplesMs: [40, 55, 65],
          summary: summarizeAuthorizePerformanceDurations([40, 55, 65]),
          evaluation: 'accepted',
          evaluationLabel: 'erfüllt',
          observedCacheStatuses: ['miss', 'miss', 'miss'],
        },
        {
          scenario: 'recompute',
          samplesMs: [80, 90, 120],
          summary: summarizeAuthorizePerformanceDurations([80, 90, 120]),
          evaluation: 'rejected',
          evaluationLabel: 'nicht erfüllt',
          observedCacheStatuses: ['recompute', 'recompute', 'recompute'],
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
    expect(markdown).toMatch(/Cache-Status: recompute, recompute, recompute/);
  });

  it('renders fallback markdown values when cache-hit and optional report fields are absent', () => {
    const markdown = renderAuthorizePerformanceMarkdownReport({
      generatedAt: '2026-05-25T17:30:00.000Z',
      measuredOn: 'server',
      actor: {
        instanceId: 'de-musterhausen',
        keycloakSubject: 'kc-user-2',
      },
      request: {
        action: 'content.read',
        resourceType: 'content',
      },
      configuration: {
        measuredRequests: 12,
        warmupRequests: 2,
      },
      scenarios: [
        {
          scenario: 'recompute',
          samplesMs: [120],
          summary: summarizeAuthorizePerformanceDurations([120]),
          evaluation: 'rejected',
          evaluationLabel: 'nicht erfüllt',
          observedCacheStatuses: ['recomputed'],
        },
      ],
    });

    expect(markdown).toMatch(/Resource-ID: n\. v\./);
    expect(markdown).toMatch(/Organisationskontext: n\. v\./);
    expect(markdown).toMatch(/p95 < 100 ms im Cache-Hit-Szenario: nicht erfüllt/);
    expect(markdown).not.toMatch(/JSON-Report/);
    expect(markdown).not.toMatch(/Markdown-Report/);
  });
});
