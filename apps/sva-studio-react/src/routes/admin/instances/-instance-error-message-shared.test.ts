import { describe, expect, it } from 'vitest';

import { getInstanceErrorMessage } from './-instance-error-message-shared';

describe('getInstanceErrorMessage', () => {
  it('maps diagnostics, classifications, codes, and fallback errors', () => {
    expect(
      getInstanceErrorMessage({
        name: 'IamHttpError',
        status: 500,
        code: 'internal_error',
        message: 'läuft',
        diagnosticStatus: 'recovery_laeuft',
      } as never),
    ).toContain('wiederhergestellt');

    expect(
      getInstanceErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'internal_error',
        message: 'drift',
        classification: 'database_or_schema_drift',
      } as never),
    ).toContain('Datenbank');

    expect(
      getInstanceErrorMessage({
        name: 'IamHttpError',
        status: 502,
        code: 'tenant_admin_client_secret_missing',
        message: 'fehlt',
      }),
    ).toContain('Tenant-Admin-Client-Secret');

    expect(
      getInstanceErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'internal_error',
        message: 'reconcile',
        classification: 'keycloak_reconcile',
      } as never),
    ).toContain('Abgleich');

    expect(
      getInstanceErrorMessage({
        name: 'IamHttpError',
        status: 409,
        code: 'unknown_module_contract',
        message: 'fehlt',
        classification: 'registry_or_provisioning_drift',
        safeDetails: {
          moduleIds: ['legacy-module'],
          errorCodes: ['unknown_module_contract:legacy-module'],
        },
      } as never)
    ).toBe(
      'Für folgende Module fehlt der IAM-Vertrag: legacy-module. Diagnosecodes: unknown_module_contract:legacy-module.'
    );

    expect(getInstanceErrorMessage(null)).toBe('Die Instanzverwaltung konnte nicht geladen werden.');
  });
});
