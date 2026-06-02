import { describe, expect, it } from 'vitest';

import {
  buildOrganizationMainserverSecretAad,
  projectOrganizationMainserverCredentialState,
} from './organization-mainserver-credentials.js';

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
});
