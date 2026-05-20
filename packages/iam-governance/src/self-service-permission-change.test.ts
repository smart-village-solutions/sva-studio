import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSelfServicePermissionChangeRequest } from './self-service-permission-change.js';
import type { QueryClient } from './query-client.js';

type QueryResult = {
  rowCount: number;
  rows: unknown[];
};

const buildClient = (...results: QueryResult[]): { client: QueryClient; query: ReturnType<typeof vi.fn> } => {
  const queue = [...results];
  const query = vi.fn(async () => queue.shift() ?? { rowCount: 0, rows: [] });
  return { client: { query }, query };
};

describe('self-service permission change request', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T09:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an intake request and emits a governance audit record', async () => {
    const { client, query } = buildClient(
      { rowCount: 1, rows: [{ id: 'account-1' }] },
      { rowCount: 1, rows: [{ id: 'workflow-1' }] },
      { rowCount: 0, rows: [] }
    );

    const result = await createSelfServicePermissionChangeRequest(client, {
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'kc-user-1',
      requestNote: 'Ich benötige zusätzliche Rechte für die redaktionelle Freigabe.',
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(result).toEqual({
      workflowId: 'workflow-1',
      actorAccountId: 'account-1',
    });
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO iam.permission_change_requests'),
      ['de-musterhausen', 'account-1', 'Ich benötige zusätzliche Rechte für die redaktionelle Freigabe.']
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO iam.activity_logs'),
      expect.arrayContaining([
        'de-musterhausen',
        'account-1',
        'governance_permission_change_requested',
        expect.any(String),
        'req-1',
        'trace-1',
      ])
    );
    const payload = JSON.parse(((query.mock.calls[2] ?? [])[1] as unknown[])[3] as string) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('request_note_preview');
  });

  it('returns null when the actor cannot be resolved or the insert yields no workflow id', async () => {
    const unresolved = buildClient({ rowCount: 0, rows: [] });
    await expect(
      createSelfServicePermissionChangeRequest(unresolved.client, {
        instanceId: 'de-musterhausen',
        actorKeycloakSubject: 'missing',
        requestNote: 'Need access',
      })
    ).resolves.toBeNull();
    expect(unresolved.query).toHaveBeenCalledTimes(1);

    const missingWorkflow = buildClient(
      { rowCount: 1, rows: [{ id: 'account-1' }] },
      { rowCount: 0, rows: [] }
    );
    await expect(
      createSelfServicePermissionChangeRequest(missingWorkflow.client, {
        instanceId: 'de-musterhausen',
        actorKeycloakSubject: 'kc-user-1',
        requestNote: 'Need access',
      })
    ).resolves.toBeNull();
    expect(missingWorkflow.query).toHaveBeenCalledTimes(2);
  });
});
