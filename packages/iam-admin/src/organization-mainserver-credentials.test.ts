import { describe, expect, it, vi } from 'vitest';

vi.mock('./encryption.js', () => ({
  protectField: vi.fn((value: string | null | undefined, aad: string) =>
    value ? `enc:${aad}:${value}` : null
  ),
}));

import {
  buildOrganizationMainserverSecretAad,
  projectOrganizationMainserverCredentialState,
  reserveOrganizationMainserverProvisioning,
  updateOrganizationMainserverProvisioningState,
  upsertOrganizationMainserverCredentials,
} from './organization-mainserver-credentials.js';
import type { QueryClient } from './query-client.js';

describe('organization mainserver credentials', () => {
  it('builds a stable AAD path for organization secrets', () => {
    expect(buildOrganizationMainserverSecretAad('org-1')).toBe(
      'iam.organization_mainserver_credentials.mainserver_application_secret:org-1'
    );
  });

  it('projects a write-safe credential state without exposing the secret', () => {
    expect(
      projectOrganizationMainserverCredentialState({
        mainserver_application_id: 'org-app-1',
        mainserver_application_secret_ciphertext: 'enc:v1:payload',
        technical_account_id: 'account-1',
        provisioning_status: 'ready',
        operation_reference: 'operation-1',
        provisioning_phase: 'completed',
        attempt_count: 2,
        lease_expires_at: null,
        last_error_code: null,
        last_attempt_at: '2026-08-11T09:00:00.000Z',
        completed_at: '2026-08-11T09:01:00.000Z',
        last_verified_at: '2026-08-11T09:01:00.000Z',
      })
    ).toEqual({
      mainserverApplicationId: 'org-app-1',
      mainserverApplicationSecretSet: true,
      technicalAccountId: 'account-1',
      provisioningStatus: 'ready',
      operationReference: 'operation-1',
      provisioningPhase: 'completed',
      attemptCount: 2,
      lastAttemptAt: '2026-08-11T09:00:00.000Z',
      completedAt: '2026-08-11T09:01:00.000Z',
      lastVerifiedAt: '2026-08-11T09:01:00.000Z',
    });
  });

  it('keeps the previous audit actor when no actor account id is provided', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({
        rows: [
          {
            mainserver_application_id: 'org-app-1',
            mainserver_application_secret_ciphertext: 'enc:old-secret',
            technical_account_id: null,
            provisioning_status: 'verification_required',
            operation_reference: null,
            provisioning_phase: null,
            attempt_count: 0,
            lease_expires_at: null,
            last_error_code: null,
            last_attempt_at: null,
            completed_at: null,
            last_verified_at: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rowCount: 1, rows: [] } as never);
    const client = { query } as unknown as QueryClient;

    await upsertOrganizationMainserverCredentials(client, {
      instanceId: 'de-musterhausen',
      organizationId: '11111111-1111-1111-8111-111111111111',
      mainserverApplicationId: 'org-app-2',
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'updated_by_account_id = COALESCE(EXCLUDED.updated_by_account_id, iam.organization_mainserver_credentials.updated_by_account_id)'
      ),
      [
        'de-musterhausen',
        '11111111-1111-1111-8111-111111111111',
        'org-app-2',
        'enc:old-secret',
        null,
        'verification_required',
      ]
    );
  });

  it('marks incomplete manual credentials as not provisioned instead of keeping ready', async () => {
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({
        rows: [
          {
            mainserver_application_id: 'org-app-1',
            mainserver_application_secret_ciphertext: 'enc:old-secret',
            technical_account_id: 'account-1',
            provisioning_status: 'ready',
            operation_reference: null,
            provisioning_phase: 'completed',
            attempt_count: 1,
            lease_expires_at: null,
            last_error_code: null,
            last_attempt_at: null,
            completed_at: null,
            last_verified_at: null,
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rowCount: 1, rows: [] } as never);

    await expect(
      upsertOrganizationMainserverCredentials({ query } as unknown as QueryClient, {
        instanceId: 'de-musterhausen',
        organizationId: '11111111-1111-1111-8111-111111111111',
        mainserverApplicationId: '',
      })
    ).resolves.toMatchObject({
      mainserverApplicationId: undefined,
      mainserverApplicationSecretSet: true,
      provisioningStatus: 'not_provisioned',
    });
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ELSE 'not_provisioned'"),
      expect.arrayContaining([null, 'enc:old-secret', 'not_provisioned'])
    );
  });

  it('returns the observed active state when a parallel lease cannot be acquired', async () => {
    const row = {
      mainserver_application_id: null,
      mainserver_application_secret_ciphertext: null,
      technical_account_id: 'account-1',
      provisioning_status: 'provisioning',
      operation_reference: 'operation-existing',
      provisioning_phase: 'mainserver_request',
      attempt_count: 2,
      lease_expires_at: '2026-08-11T10:05:00.000Z',
      last_error_code: null,
      last_attempt_at: '2026-08-11T10:00:00.000Z',
      completed_at: null,
      last_verified_at: null,
    };
    const query = vi
      .fn<QueryClient['query']>()
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [row] } as never);

    await expect(
      reserveOrganizationMainserverProvisioning({ query } as unknown as QueryClient, {
        instanceId: 'de-musterhausen',
        organizationId: '11111111-1111-1111-8111-111111111111',
        operationReference: 'operation-parallel',
        actorAccountId: '22222222-2222-4222-8222-222222222222',
        leaseSeconds: 300,
      })
    ).resolves.toMatchObject({
      acquired: false,
      state: {
        operationReference: 'operation-existing',
        provisioningPhase: 'mainserver_request',
      },
    });
  });

  it('atomically reserves an expired or idle organization provisioning lease', async () => {
    const query = vi.fn<QueryClient['query']>().mockResolvedValue({
      rows: [
        {
          mainserver_application_id: null,
          mainserver_application_secret_ciphertext: null,
          technical_account_id: null,
          provisioning_status: 'provisioning',
          operation_reference: 'operation-2',
          provisioning_phase: 'reserved',
          attempt_count: 1,
          lease_expires_at: '2026-08-11T10:05:00.000Z',
          last_error_code: null,
          last_attempt_at: '2026-08-11T10:00:00.000Z',
          completed_at: null,
          last_verified_at: null,
        },
      ],
    } as never);

    await expect(
      reserveOrganizationMainserverProvisioning({ query } as unknown as QueryClient, {
        instanceId: 'de-musterhausen',
        organizationId: '11111111-1111-1111-8111-111111111111',
        operationReference: 'operation-2',
        actorAccountId: '22222222-2222-4222-8222-222222222222',
        leaseSeconds: 300,
      })
    ).resolves.toMatchObject({
      acquired: true,
      state: { provisioningStatus: 'provisioning', operationReference: 'operation-2' },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("provisioning_status NOT IN ('provisioning', 'ready')"),
      expect.arrayContaining(['operation-2', 300])
    );
  });

  it('updates provisioning state only for the current operation owner', async () => {
    const query = vi.fn<QueryClient['query']>().mockResolvedValue({ rows: [] } as never);
    await expect(
      updateOrganizationMainserverProvisioningState({ query } as unknown as QueryClient, {
        instanceId: 'de-musterhausen',
        organizationId: '11111111-1111-1111-8111-111111111111',
        operationReference: 'operation-2',
        provisioningStatus: 'failed',
        provisioningPhase: 'token_request',
        lastErrorCode: 'missing_credentials',
        releaseLease: true,
      })
    ).resolves.toBeNull();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('AND operation_reference = $3'),
      expect.arrayContaining([
        'operation-2',
        'failed',
        'token_request',
        'missing_credentials',
        true,
      ])
    );
  });
});
