import { describe, expect, it, vi } from 'vitest';

import {
  resolveActorAccountId,
  resolveMissingActorDiagnosticReason,
} from './actor-resolution-query.js';
import type { QueryClient } from './query-client.js';

describe('actor-resolution-query', () => {
  it('resolves the actor account id in instance scope', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({ rowCount: 1, rows: [{ account_id: 'account-1' }] })),
    };

    await expect(
      resolveActorAccountId(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
      })
    ).resolves.toBe('account-1');

    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('JOIN iam.instance_memberships'), [
      'inst-1',
      'subject-1',
    ]);
  });

  it('returns undefined when the actor account is missing', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
    };

    await expect(
      resolveActorAccountId(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
      })
    ).resolves.toBeUndefined();
  });

  it('distinguishes missing memberships from missing accounts', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({
        rowCount: 1,
        rows: [{ account_exists: true, membership_exists: false }],
      })),
    };

    await expect(
      resolveMissingActorDiagnosticReason(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
      })
    ).resolves.toBe('missing_instance_membership');
  });

  it('falls back to missing actor account when no diagnostic row exists', async () => {
    const client: QueryClient = {
      query: vi.fn(async () => ({ rowCount: 0, rows: [] })),
    };

    await expect(
      resolveMissingActorDiagnosticReason(client, {
        instanceId: 'inst-1',
        keycloakSubject: 'subject-1',
      })
    ).resolves.toBe('missing_actor_account');
  });
});
