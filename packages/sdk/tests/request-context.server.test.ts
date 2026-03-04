import { describe, expect, it } from 'vitest';

import {
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
});
