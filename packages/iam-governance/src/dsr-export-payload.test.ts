import { describe, expect, it, vi } from 'vitest';

import {
  collectDsrExportPayload,
  serializeDsrExportPayload,
  type DsrExportAccountSnapshot,
} from './dsr-export-payload.js';
import type { QueryClient } from './query-client.js';

const account: DsrExportAccountSnapshot = {
  id: 'account-1',
  keycloak_subject: 'kc-user-1',
  email_ciphertext: 'plain@example.org',
  display_name_ciphertext: null,
  is_blocked: false,
  soft_deleted_at: null,
  delete_after: null,
  permanently_deleted_at: null,
  processing_restricted_at: null,
  processing_restriction_reason: null,
  non_essential_processing_opt_out_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
};

describe('dsr-export-payload', () => {
  it('collects account-related export data from governance tables', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'org-1', organization_key: 'city', display_name: 'Musterhausen' }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 'role-1', role_name: 'citizen', description: null }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'hold-1',
          active: true,
          hold_reason: 'audit',
          hold_until: null,
          created_at: '2026-01-03T00:00:00.000Z',
        }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'request-1',
          request_type: 'access',
          status: 'completed',
          request_accepted_at: '2026-01-04T00:00:00.000Z',
          completed_at: '2026-01-04T01:00:00.000Z',
        }],
      });

    const payload = await collectDsrExportPayload(
      { query },
      { instanceId: 'de-musterhausen', account, format: 'json' }
    );

    expect(payload).toMatchObject({
      meta: { instanceId: 'de-musterhausen', format: 'json', subject: 'kc-user-1' },
      account: { id: 'account-1', keycloakSubject: 'kc-user-1', isBlocked: false },
      organizations: [{ id: 'org-1', organizationKey: 'city', displayName: 'Musterhausen' }],
      roles: [{ id: 'role-1', roleName: 'citizen', description: null }],
      legalHolds: [{ id: 'hold-1', active: true, holdReason: 'audit' }],
      dsrRequests: [{ id: 'request-1', requestType: 'access', status: 'completed' }],
      consents: { nonEssentialProcessingAllowed: true },
    });
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('serializes payloads as json, csv and xml', () => {
    const payload = {
      meta: {
        generatedAt: '2026-01-01T00:00:00.000Z',
        instanceId: 'de-musterhausen',
        format: 'json' as const,
        subject: 'kc-user-1',
      },
      account: {
        id: 'account-1',
        keycloakSubject: 'kc-user-1',
        isBlocked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      organizations: [],
      roles: [],
      legalHolds: [],
      dsrRequests: [],
      consents: { nonEssentialProcessingAllowed: true },
    };

    expect(serializeDsrExportPayload('json', payload)).toContain('"subject": "kc-user-1"');
    expect(serializeDsrExportPayload('csv', payload)).toContain('meta.subject,kc-user-1');
    expect(serializeDsrExportPayload('xml', payload)).toContain('<subject>kc-user-1</subject>');
  });
});
