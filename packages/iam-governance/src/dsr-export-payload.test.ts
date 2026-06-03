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
          group_id: 'group-1',
          group_key: 'district-editors',
          display_name: 'District Editors',
          group_type: 'custom',
          origin: 'direct',
          valid_from: '2026-01-05T00:00:00.000Z',
          valid_until: null,
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
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id: 'acceptance-1',
          legal_text_id: 'privacy-policy',
          legal_text_version: '2026-05',
          name: 'Datenschutzhinweise',
          locale: 'de',
          accepted_at: '2026-01-06T00:00:00.000Z',
          revoked_at: null,
          action_type: 'accepted',
        }],
      });

    const payload = await collectDsrExportPayload(
      { query },
      { instanceId: 'de-musterhausen', account, format: 'json' }
    );

    expect(payload).toMatchObject({
      meta: { instanceId: 'de-musterhausen', format: 'json' },
      account: { id: 'account-1', isBlocked: false },
      organizations: [{ id: 'org-1', organizationKey: 'city', displayName: 'Musterhausen' }],
      roles: [{ id: 'role-1', roleName: 'citizen', description: null }],
      groups: [{
        groupId: 'group-1',
        groupKey: 'district-editors',
        displayName: 'District Editors',
        groupType: 'custom',
        origin: 'direct',
        validFrom: '2026-01-05T00:00:00.000Z',
      }],
      legalHolds: [{ id: 'hold-1', active: true, holdReason: 'audit' }],
      dsrRequests: [{ id: 'request-1', requestType: 'access', status: 'completed' }],
      legalAcceptances: [{
        id: 'acceptance-1',
        legalTextId: 'privacy-policy',
        legalTextVersion: '2026-05',
        name: 'Datenschutzhinweise',
        locale: 'de',
        acceptedAt: '2026-01-06T00:00:00.000Z',
        actionType: 'accepted',
      }],
      consents: { nonEssentialProcessingAllowed: true },
    });
    expect(payload.meta).not.toHaveProperty('subject');
    expect(payload.account).not.toHaveProperty('keycloakSubject');
    expect(payload.account).not.toHaveProperty('encryptedEmail');
    expect(payload.account).not.toHaveProperty('encryptedDisplayName');
    expect(query).toHaveBeenCalledTimes(6);
  });

  it('serializes payloads as json, csv and xml', () => {
    const payload = {
      meta: {
        generatedAt: '2026-01-01T00:00:00.000Z',
        instanceId: 'de-musterhausen',
        format: 'json' as const,
      },
      account: {
        id: 'account-1',
        isBlocked: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      organizations: [],
      roles: [],
      groups: [],
      legalHolds: [],
      dsrRequests: [],
      legalAcceptances: [],
      consents: { nonEssentialProcessingAllowed: true },
    };

    expect(serializeDsrExportPayload('json', payload)).not.toContain('"subject"');
    expect(serializeDsrExportPayload('csv', payload)).not.toContain('meta.subject');
    expect(serializeDsrExportPayload('xml', payload)).not.toContain('<subject>');
  });
});
