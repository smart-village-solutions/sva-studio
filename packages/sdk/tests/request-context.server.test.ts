import { describe, expect, it } from 'vitest';

import {
  extractWorkspaceIdFromHeaders,
  getHeadersFromRequest,
  extractRequestIdFromHeaders,
  extractTraceIdFromHeaders,
  withRequestContext,
} from '../src/middleware/request-context.server';
import { getWorkspaceContext } from '../src/observability/context.server';

describe('request-context middleware helpers', () => {
  it('extracts request_id from x-request-id header', () => {
    const requestId = extractRequestIdFromHeaders({
      'x-request-id': 'req-123',
    });
    expect(requestId).toBe('req-123');
  });

  it('falls back to x-correlation-id and ignores empty leading values', () => {
    const requestId = extractRequestIdFromHeaders({
      'x-request-id': [' ', 'req-ignored'],
      'x-correlation-id': 'corr-123',
    });

    expect(requestId).toBe('corr-123');
  });

  it('extracts trace_id from traceparent header', () => {
    const traceId = extractTraceIdFromHeaders({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
    expect(traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('extracts trace_id from differently cased traceparent headers', () => {
    const uppercaseTraceId = extractTraceIdFromHeaders({
      TRACEPARENT: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
    });
    expect(uppercaseTraceId).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

    const mixedCaseTraceId = extractTraceIdFromHeaders({
      TrAcEpArEnT: '00-cccccccccccccccccccccccccccccccc-dddddddddddddddd-01',
    });
    expect(mixedCaseTraceId).toBe('cccccccccccccccccccccccccccccccc');
  });

  it('ignores invalid request_id header values', () => {
    const requestId = extractRequestIdFromHeaders({
      'x-request-id': 'req-123\nmalicious',
    });
    expect(requestId).toBeUndefined();
  });

  it('validates trace_id fallback header format', () => {
    const validTraceId = extractTraceIdFromHeaders({
      'x-trace-id': '4bf92f3577b34da6a3ce929d0e0e4736',
    });
    const invalidTraceId = extractTraceIdFromHeaders({
      'x-trace-id': 'trace-123',
    });

    expect(validTraceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(invalidTraceId).toBeUndefined();
  });

  it('ignores invalid traceparent and uses x-trace-id fallback', () => {
    const traceId = extractTraceIdFromHeaders({
      traceparent: 'invalid-traceparent',
      'x-trace-id': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });

    expect(traceId).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('normalizes headers from Request and plain objects', () => {
    const requestHeaders = getHeadersFromRequest(
      new Request('http://localhost', {
        headers: {
          'X-Workspace-Id': 'ws-request',
          'X-Request-Id': 'req-request',
        },
      })
    );
    const objectHeaders = getHeadersFromRequest({
      headers: {
        'X-Workspace-Id': 'ws-object',
      },
    });

    expect(requestHeaders).toMatchObject({
      'x-workspace-id': 'ws-request',
      'x-request-id': 'req-request',
    });
    expect(objectHeaders).toMatchObject({
      'x-workspace-id': 'ws-object',
    });
  });

  it('extracts workspace id from alternate headers', () => {
    const workspaceId = extractWorkspaceIdFromHeaders(
      {
        'x-sva-workspace-id': 'ws-alt',
      },
      ['x-workspace-id', 'x-sva-workspace-id']
    );

    expect(workspaceId).toBe('ws-alt');
  });

  it('propagates workspace_id, request_id and trace_id via withRequestContext', async () => {
    const request = new Request('http://localhost/auth/me', {
      headers: {
        'x-workspace-id': 'ws-1',
        'x-request-id': 'req-42',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    });

    await withRequestContext({ request, fallbackWorkspaceId: 'default' }, async () => {
      const context = getWorkspaceContext();
      expect(context.workspaceId).toBe('ws-1');
      expect(context.requestId).toBe('req-42');
      expect(context.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    });
  });

  it('prefers explicit overrides and fallback workspace id', async () => {
    const request = new Request('http://localhost/auth/me', {
      headers: {
        'x-workspace-id': 'ws-header',
        'x-request-id': 'req-header',
        'x-trace-id': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    });

    await withRequestContext(
      {
        request,
        workspaceId: 'ws-explicit',
        requestId: 'req-explicit',
        traceId: 'cccccccccccccccccccccccccccccccc',
        fallbackWorkspaceId: 'ws-fallback',
      },
      async () => {
        const context = getWorkspaceContext();
        expect(context.workspaceId).toBe('ws-explicit');
        expect(context.requestId).toBe('req-explicit');
        expect(context.traceId).toBe('cccccccccccccccccccccccccccccccc');
      }
    );
  });

  it('uses fallback workspace when no request is provided', async () => {
    await withRequestContext({ fallbackWorkspaceId: 'ws-fallback' }, async () => {
      const context = getWorkspaceContext();
      expect(context.workspaceId).toBe('ws-fallback');
      expect(context.requestId).toBeTruthy();
    });
  });
});
