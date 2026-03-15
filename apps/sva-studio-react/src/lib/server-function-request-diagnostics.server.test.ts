import { describe, expect, it } from 'vitest';

import {
  SERVER_FN_HTML_ROUTER_FALLBACK_MESSAGE,
  createServerFunctionRequestDiagnostics,
  normalizeServerFnBase,
  readServerFunctionResponseBodyForDiagnostics,
  resolveServerFunctionBranchDecision,
} from './server-function-request-diagnostics.server';

describe('server-function-request-diagnostics.server', () => {
  it('normalizes the configured server function base path', () => {
    expect(normalizeServerFnBase('/_server')).toBe('/_server/');
    expect(normalizeServerFnBase('_server')).toBe('/_server/');
    expect(normalizeServerFnBase(undefined)).toBe('/_server/');
  });

  it('detects requests that target the configured server function base path', () => {
    const diagnostics = createServerFunctionRequestDiagnostics({
      request: new Request('http://localhost:3000/_server/abc123', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
      }),
      requestId: 'req-123',
      serverFnBase: '/_server',
    });

    expect(diagnostics).toMatchObject({
      method: 'POST',
      path: '/_server/abc123',
      serverFnBase: '/_server/',
      requestId: 'req-123',
      accept: 'application/json',
      contentType: 'application/json',
      isServerFnRequest: true,
    });
  });

  it('marks HTML-router fallback responses explicitly', () => {
    const diagnostics = createServerFunctionRequestDiagnostics({
      request: new Request('http://localhost:3000/_server/abc123', { method: 'POST' }),
      requestId: 'req-456',
      serverFnBase: '/_server/',
    });

    const branchDecision = resolveServerFunctionBranchDecision({
      diagnostics,
      responseStatus: 500,
      responseBody: JSON.stringify({ error: SERVER_FN_HTML_ROUTER_FALLBACK_MESSAGE }),
    });

    expect(branchDecision).toBe('fell_through_to_html_router');
  });

  it('treats other responses as successfully matched server function requests', () => {
    const diagnostics = createServerFunctionRequestDiagnostics({
      request: new Request('http://localhost:3000/_server/abc123', { method: 'POST' }),
      requestId: 'req-789',
      serverFnBase: '/_server/',
    });

    const branchDecision = resolveServerFunctionBranchDecision({
      diagnostics,
      responseStatus: 200,
      responseBody: '{"result":"ok"}',
    });

    expect(branchDecision).toBe('server_fn_matched');
  });

  it('reads small JSON error payloads without consuming the original response', async () => {
    const response = new Response(JSON.stringify({ error: SERVER_FN_HTML_ROUTER_FALLBACK_MESSAGE }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    await expect(readServerFunctionResponseBodyForDiagnostics(response)).resolves.toContain(
      SERVER_FN_HTML_ROUTER_FALLBACK_MESSAGE
    );
    await expect(response.text()).resolves.toContain(SERVER_FN_HTML_ROUTER_FALLBACK_MESSAGE);
  });
});
