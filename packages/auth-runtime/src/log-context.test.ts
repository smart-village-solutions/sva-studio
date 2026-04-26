import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getWorkspaceContext: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
}));

import { buildLogContext } from './log-context.js';

describe('auth runtime log context', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('uses explicit instance scope before ambient workspace context', () => {
    mocks.getWorkspaceContext.mockReturnValue({
      workspaceId: 'ambient',
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(buildLogContext({ kind: 'instance', instanceId: 'tenant-a' }, { includeTraceId: true })).toEqual({
      workspace_id: 'tenant-a',
      scope_kind: 'instance',
      instance_id: 'tenant-a',
      request_id: 'req-1',
      trace_id: 'trace-1',
    });
  });

  it('classifies workspace id strings and omits trace ids unless requested', () => {
    mocks.getWorkspaceContext.mockReturnValue({ requestId: 'req-2', traceId: 'trace-2' });

    expect(buildLogContext('platform')).toEqual({
      workspace_id: 'platform',
      scope_kind: 'platform',
      instance_id: undefined,
      request_id: 'req-2',
    });
    expect(buildLogContext('tenant-a')).toEqual({
      workspace_id: 'tenant-a',
      scope_kind: 'instance',
      instance_id: 'tenant-a',
      request_id: 'req-2',
    });
  });

  it('falls back to ambient or default workspace ids', () => {
    mocks.getWorkspaceContext.mockReturnValue({ workspaceId: 'ambient', requestId: 'req-3' });
    expect(buildLogContext()).toMatchObject({ workspace_id: 'ambient', request_id: 'req-3' });

    mocks.getWorkspaceContext.mockReturnValue({});
    expect(buildLogContext()).toMatchObject({ workspace_id: 'default' });
  });
});
