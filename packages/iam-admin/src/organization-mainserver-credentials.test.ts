import { describe, expect, it, vi } from 'vitest';

vi.mock('./encryption.js', () => ({
  protectField: vi.fn((value: string | null | undefined, aad: string) => (value ? `enc:${aad}:${value}` : null)),
}));

import {
  buildOrganizationMainserverSecretAad,
  projectOrganizationMainserverCredentialState,
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
      })
    ).toEqual({
      mainserverApplicationId: 'org-app-1',
      mainserverApplicationSecretSet: true,
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
      ]
    );
  });
});
