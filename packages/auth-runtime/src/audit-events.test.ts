import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  getWorkspaceContext: vi.fn(),
  persistAuthAuditEventToDb: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => mocks.logger),
  getWorkspaceContext: mocks.getWorkspaceContext,
}));

vi.mock('./audit-db-sink.js', () => ({
  persistAuthAuditEventToDb: mocks.persistAuthAuditEventToDb,
}));

import { emitAuthAuditEvent } from './audit-events.js';

describe('auth audit event emitter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('logs and persists audit events with ambient workspace context', async () => {
    mocks.getWorkspaceContext.mockReturnValue({ workspaceId: 'tenant-a', requestId: 'req-1', traceId: 'trace-1' });
    mocks.persistAuthAuditEventToDb.mockResolvedValue({
      persisted: true,
      writtenEventTypes: ['login', 'account_created'],
    });

    await emitAuthAuditEvent({
      eventType: 'login',
      actorUserId: 'user-1',
      outcome: 'success',
    });

    expect(mocks.logger.info).toHaveBeenCalledWith(
      'Auth audit event emitted',
      expect.objectContaining({
        event_type: 'login',
        workspace_id: 'tenant-a',
        request_id: 'req-1',
        trace_id: 'trace-1',
        actor_user_id: 'user-1',
        sink: 'otel',
      })
    );
    expect(mocks.persistAuthAuditEventToDb).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'login',
        workspaceId: 'tenant-a',
        requestId: 'req-1',
        traceId: 'trace-1',
      })
    );
    expect(mocks.logger.info).toHaveBeenCalledWith(
      'Auth audit event persisted to DB sink',
      expect.objectContaining({
        additional_event_types: ['account_created'],
        sink: 'db',
        status: 'persisted',
      })
    );
  });

  it('logs skipped database writes with plugin action context', async () => {
    mocks.getWorkspaceContext.mockReturnValue({});
    mocks.persistAuthAuditEventToDb.mockResolvedValue({
      persisted: false,
      reason: 'database_url_missing',
      writtenEventTypes: [],
    });

    await emitAuthAuditEvent({
      eventType: 'plugin_action_denied',
      outcome: 'denied',
      scope: { kind: 'platform' },
      pluginAction: {
        actionId: 'news.publish',
        actionNamespace: 'news',
        actionOwner: 'plugin-news',
        result: 'denied',
        reasonCode: 'missing_permission',
      },
    });

    expect(mocks.logger.debug).toHaveBeenCalledWith(
      'Auth audit event skipped for DB sink',
      expect.objectContaining({
        action_id: 'news.publish',
        action_namespace: 'news',
        plugin_action_result: 'denied',
        reason_code: 'missing_permission',
        workspace_id: 'platform',
        sink: 'db',
        status: 'skipped',
        reason: 'database_url_missing',
      })
    );
  });

  it('logs database sink failures without throwing', async () => {
    mocks.getWorkspaceContext.mockReturnValue({ workspaceId: 'platform', requestId: 'req-2' });
    mocks.persistAuthAuditEventToDb.mockRejectedValue(new TypeError('db failed'));

    await expect(
      emitAuthAuditEvent({
        eventType: 'logout',
        outcome: 'success',
      })
    ).resolves.toBeUndefined();

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Auth audit DB sink failed',
      expect.objectContaining({
        event_type: 'logout',
        workspace_id: 'platform',
        sink: 'db',
        status: 'failed',
        error_type: 'TypeError',
        reason_code: 'platform_audit_unavailable',
      })
    );
  });
});
