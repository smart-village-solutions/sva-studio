import { describe, expect, it } from 'vitest';
import { runWithWorkspaceContext } from '../observability/context.server.js';
import { enrichLogInfoWithContext } from './index.server.js';

type TransformableInfo = Parameters<typeof enrichLogInfoWithContext>[0];

describe('enrichLogInfoWithContext', () => {
  it('adds canonical top-level correlation fields and keeps the compatibility context', () => {
    const info = runWithWorkspaceContext(
      {
        workspaceId: 'workspace-1',
        requestId: 'request-1',
        traceId: '0123456789abcdef0123456789abcdef',
      },
      () => enrichLogInfoWithContext({ level: 'info', message: 'test' } as TransformableInfo)
    );

    expect(info).toMatchObject({
      workspace_id: 'workspace-1',
      request_id: 'request-1',
      trace_id: '0123456789abcdef0123456789abcdef',
      context: {
        request_id: 'request-1',
        trace_id: '0123456789abcdef0123456789abcdef',
      },
    });
  });

  it('does not overwrite explicit correlation fields', () => {
    const info = runWithWorkspaceContext(
      {
        requestId: 'ambient-request',
        traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
      () =>
        enrichLogInfoWithContext({
          level: 'info',
          message: 'test',
          request_id: 'explicit-request',
          trace_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        } as TransformableInfo)
    );

    expect(info).toMatchObject({
      request_id: 'explicit-request',
      trace_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
  });
});
