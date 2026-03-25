import { describe, expect, it } from 'vitest';

import type { QueryClient } from './shared/db-helpers';
import { jitProvisionAccountWithClient } from './jit-provisioning.server';

type MockQueryResult<TRow> = {
  rowCount: number;
  rows: TRow[];
};

type AccountState = {
  id: string;
  created: boolean;
};

const createMockClient = () => {
  const stateBySubject = new Map<string, AccountState>();
  let activityEvents = 0;

  const queryClient: QueryClient = {
    query: async <TRow = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[]
    ): Promise<MockQueryResult<TRow>> => {
      const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normalized.includes('insert into iam.accounts')) {
        const keycloakSubject = String(values?.[1] ?? '');
        const existing = stateBySubject.get(keycloakSubject);
        if (existing) {
          return {
            rowCount: 1,
            rows: [{ id: existing.id, created: false } as TRow],
          };
        }

        const created = { id: `${keycloakSubject}-account`, created: true };
        stateBySubject.set(keycloakSubject, created);
        return {
          rowCount: 1,
          rows: [{ id: created.id, created: true } as TRow],
        };
      }

      if (normalized.includes('insert into iam.instance_memberships')) {
        return { rowCount: 1, rows: [] };
      }

      if (normalized.includes("insert into iam.activity_logs") && normalized.includes('user.jit_provisioned')) {
        activityEvents += 1;
        return { rowCount: 1, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  };

  return {
    queryClient,
    getActivityEvents: () => activityEvents,
  };
};

describe('jitProvisionAccountWithClient', () => {
  it('creates account with pending status and emits user.jit_provisioned on first login', async () => {
    const mock = createMockClient();

    const result = await jitProvisionAccountWithClient(mock.queryClient, {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      requestId: 'req-1',
      traceId: 'trace-1',
    });

    expect(result.accountId).toBe('kc-user-1-account');
    expect(result.created).toBe(true);
    expect(mock.getActivityEvents()).toBe(1);
  });

  it('updates timestamp on repeated login without emitting duplicate jit event', async () => {
    const mock = createMockClient();
    const input = {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-2',
      requestId: 'req-2',
      traceId: 'trace-2',
    };

    const first = await jitProvisionAccountWithClient(mock.queryClient, input);
    const second = await jitProvisionAccountWithClient(mock.queryClient, input);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(mock.getActivityEvents()).toBe(1);
  });

  it('can skip audit writes for self-service reads while still provisioning the account', async () => {
    const mock = createMockClient();

    const result = await jitProvisionAccountWithClient(mock.queryClient, {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-4',
      requestId: 'req-4',
      traceId: 'trace-4',
      emitAuditLog: false,
    });

    expect(result.accountId).toBe('kc-user-4-account');
    expect(result.created).toBe(true);
    expect(mock.getActivityEvents()).toBe(0);
  });

  it('handles concurrent first logins deterministically (one created, one updated)', async () => {
    const mock = createMockClient();
    const input = {
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-3',
      requestId: 'req-3',
      traceId: 'trace-3',
    };

    const [first, second] = await Promise.all([
      jitProvisionAccountWithClient(mock.queryClient, input),
      jitProvisionAccountWithClient(mock.queryClient, input),
    ]);

    const createdCount = [first, second].filter((entry) => entry.created).length;
    expect(createdCount).toBe(1);
    expect(mock.getActivityEvents()).toBe(1);
  });
});
