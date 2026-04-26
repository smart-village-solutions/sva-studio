import { describe, expect, it } from 'vitest';

import { getWorkspaceContext } from '../observability/context.server.js';
import {
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  extractWorkspaceIdFromHeaders,
  getHeadersFromRequest,
  withRequestContext,
} from './request-context.server.js';

describe('request context middleware helpers', () => {
  it('normalizes headers from web requests and plain request objects', () => {
    const webRequest = new Request('https://example.test', {
      headers: {
        'X-Workspace-Id': 'tenant-a',
        'X-Request-Id': 'request-a',
      },
    });

    expect(getHeadersFromRequest(webRequest)).toMatchObject({
      'x-workspace-id': 'tenant-a',
      'x-request-id': 'request-a',
    });
    expect(getHeadersFromRequest({ headers: new Headers({ 'X-Trace-Id': 'a'.repeat(32) }) })).toEqual({
      'x-trace-id': 'a'.repeat(32),
    });
    expect(getHeadersFromRequest({ headers: { 'X-Request-Id': ['request-b'] } })).toEqual({
      'x-request-id': ['request-b'],
    });
    expect(getHeadersFromRequest({})).toEqual({});
  });

  it('extracts workspace, request and trace ids with validation', () => {
    const validTraceId = '0123456789abcdef0123456789abcdef';
    const headers = {
      'x-workspace-id': ['tenant-a'],
      'x-request-id': ' request-1 ',
      traceparent: `00-${validTraceId}-0123456789abcdef-01`,
      'x-trace-id': 'ignored',
    };

    expect(extractWorkspaceIdFromHeaders(headers)).toBe('tenant-a');
    expect(extractWorkspaceIdFromHeaders({ 'x-sva-workspace-id': 'tenant-b' })).toBe('tenant-b');
    expect(extractWorkspaceIdFromHeaders({ 'x-workspace-id': [] })).toBeUndefined();
    expect(extractRequestIdFromHeaders(headers)).toBe('request-1');
    expect(extractRequestIdFromHeaders({ 'x-request-id': 'bad id!' })).toBeUndefined();
    expect(extractRequestIdFromHeaders({ 'x-correlation-id': ['c-1'] })).toBe('c-1');
    expect(extractTraceIdFromHeaders(headers)).toBe(validTraceId);
    expect(extractTraceIdFromHeaders({ 'x-trace-id': validTraceId })).toBe(validTraceId);
    expect(extractTraceIdFromHeaders({ 'x-trace-id': 'not-a-trace' })).toBeUndefined();
  });

  it('runs callbacks inside the derived workspace context', async () => {
    const result = await withRequestContext(
      {
        request: {
          headers: {
            'x-sva-workspace-id': 'tenant-c',
            'x-request-id': 'request-c',
            'x-trace-id': 'fedcba9876543210fedcba9876543210',
          },
        },
      },
      () => getWorkspaceContext()
    );

    expect(result).toEqual({
      workspaceId: 'tenant-c',
      requestId: 'request-c',
      traceId: 'fedcba9876543210fedcba9876543210',
    });

    await expect(
      withRequestContext(
        {
          fallbackWorkspaceId: 'fallback-tenant',
          requestId: 'explicit-request',
          traceId: 'explicit-trace',
        },
        () => getWorkspaceContext()
      )
    ).resolves.toEqual({
      workspaceId: 'fallback-tenant',
      requestId: 'explicit-request',
      traceId: 'explicit-trace',
    });
  });
});
