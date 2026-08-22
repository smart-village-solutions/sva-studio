import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  context: {} as { workspaceId?: string; requestId?: string; traceId?: string },
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/server-runtime')>()),
  createSdkLogger: vi.fn(() => state.logger),
  getWorkspaceContext: vi.fn(() => state.context),
}));

import { readRoutingDiagnosticsContextFromRequest } from './diagnostics.server.js';

describe('readRoutingDiagnosticsContextFromRequest', () => {
  beforeEach(() => {
    state.context = {};
  });

  it('uses the already established ambient request context as fallback', () => {
    state.context = {
      workspaceId: 'ambient-workspace',
      requestId: 'ambient-request',
      traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };

    expect(
      readRoutingDiagnosticsContextFromRequest(new Request('https://studio.example/auth/me'))
    ).toEqual({
      workspace_id: 'ambient-workspace',
      request_id: 'ambient-request',
      trace_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
  });

  it('prefers valid request headers and an explicit instance query', () => {
    state.context = {
      workspaceId: 'ambient-workspace',
      requestId: 'ambient-request',
      traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    };
    const request = new Request('https://studio.example/auth/me?instanceId=query-workspace', {
      headers: {
        'x-request-id': 'header-request',
        'x-trace-id': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    });

    expect(readRoutingDiagnosticsContextFromRequest(request)).toEqual({
      workspace_id: 'query-workspace',
      request_id: 'header-request',
      trace_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
  });
});
