import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IamRuntimeDiagnosticDetails } from './-iam-runtime-diagnostic-details';

describe('IamRuntimeDiagnosticDetails', () => {
  it('renders the known diagnostic labels and request metadata', () => {
    render(
      <IamRuntimeDiagnosticDetails
        error={
          {
            name: 'IamHttpError',
            status: 503,
            code: 'keycloak_unavailable',
            message: 'boom',
            classification: 'keycloak_reconcile',
            recommendedAction: 'rollenabgleich_pruefen',
            requestId: 'req-known',
            safeDetails: { sync_error_code: 'IDP_FORBIDDEN' },
          } as never
        }
      />
    );

    expect(screen.getByText('Diagnose: Keycloak-Reconcile')).toBeTruthy();
    expect(screen.getByText('Empfohlene Aktion: Rollenabgleich prüfen')).toBeTruthy();
    expect(screen.getByText('Sync-Fehlercode: IDP_FORBIDDEN')).toBeTruthy();
    expect(screen.getByText('Request-ID: req-known')).toBeTruthy();
  });

  it('ignores unknown diagnostic values instead of crashing the banner', () => {
    render(
      <IamRuntimeDiagnosticDetails
        error={
          {
            name: 'IamHttpError',
            status: 500,
            code: 'internal_error',
            message: 'boom',
            classification: 'future_value',
            recommendedAction: 'future_action',
            requestId: 'req-unknown',
          } as never
        }
      />
    );

    expect(screen.queryByText(/^Diagnose:/)).toBeNull();
    expect(screen.queryByText(/^Empfohlene Aktion:/)).toBeNull();
    expect(screen.getByText('Request-ID: req-unknown')).toBeTruthy();
  });
});
