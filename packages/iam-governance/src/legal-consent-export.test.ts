import { describe, expect, it, vi } from 'vitest';

import {
  consumeLegalConsentExportRateLimit,
  hasLegalConsentExportPermission,
  loadConsentExportRecords,
} from './legal-consent-export.js';

describe('legal consent export', () => {
  it('accepts explicit export permission or system admin roles', () => {
    expect(hasLegalConsentExportPermission(['system_admin'])).toBe(true);
    expect(hasLegalConsentExportPermission(['legal-consents:export'])).toBe(true);
    expect(hasLegalConsentExportPermission(['tenant_admin'])).toBe(false);
  });

  it('limits repeated export requests per actor and resets after the window', () => {
    const baseNow = 1_000;

    for (let index = 0; index < 10; index += 1) {
      expect(
        consumeLegalConsentExportRateLimit({
          instanceId: 'instance-1',
          actorKeycloakSubject: 'kc-user-1',
          now: baseNow,
        })
      ).toBeNull();
    }

    expect(
      consumeLegalConsentExportRateLimit({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-user-1',
        now: baseNow,
      })
    ).toEqual({ retryAfterSeconds: 3600 });

    expect(
      consumeLegalConsentExportRateLimit({
        instanceId: 'instance-1',
        actorKeycloakSubject: 'kc-user-1',
        now: baseNow + 60 * 60 * 1000 + 1,
      })
    ).toBeNull();
  });

  it('loads and maps consent export rows with or without account filtering', async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: 'acceptance-1',
          workspace_id: 'workspace-1',
          subject_id: null,
          legal_text_id: 'legal-text-1',
          legal_text_version: 'v1',
          accepted_at: '2026-05-09T12:00:00.000Z',
          revoked_at: null,
          action_type: null,
          target_role_ids: ['role-1'],
          target_group_ids: ['group-1'],
        },
        {
          id: 'acceptance-2',
          workspace_id: null,
          subject_id: 'subject-2',
          legal_text_id: 'legal-text-2',
          legal_text_version: 'v2',
          accepted_at: '2026-05-09T13:00:00.000Z',
          revoked_at: '2026-05-09T14:00:00.000Z',
          action_type: 'revoked',
          target_role_ids: [],
          target_group_ids: [],
        },
      ],
    });

    const allRecords = await loadConsentExportRecords(
      'instance-1',
      undefined,
      {
        query,
      } as never
    );

    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('WHERE lta.instance_id = $1 ORDER BY lta.accepted_at DESC'),
      ['instance-1']
    );
    expect(allRecords).toEqual([
      {
        id: 'acceptance-1',
        workspaceId: 'workspace-1',
        subjectId: 'acceptance-1',
        legalTextId: 'legal-text-1',
        legalTextVersion: 'v1',
        actionType: 'accepted',
        acceptedAt: '2026-05-09T12:00:00.000Z',
        targets: {
          roleIds: ['role-1'],
          groupIds: ['group-1'],
        },
      },
      {
        id: 'acceptance-2',
        subjectId: 'subject-2',
        legalTextId: 'legal-text-2',
        legalTextVersion: 'v2',
        actionType: 'revoked',
        acceptedAt: '2026-05-09T13:00:00.000Z',
        revokedAt: '2026-05-09T14:00:00.000Z',
        targets: {
          roleIds: [],
          groupIds: [],
        },
      },
    ]);

    await loadConsentExportRecords(
      'instance-1',
      'account-1',
      {
        query,
      } as never
    );

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('WHERE lta.instance_id = $1 AND lta.account_id = $2::uuid ORDER BY lta.accepted_at DESC'),
      ['instance-1', 'account-1']
    );
  });
});
