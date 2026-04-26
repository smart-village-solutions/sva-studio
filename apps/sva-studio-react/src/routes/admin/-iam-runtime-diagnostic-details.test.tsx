// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { IamRuntimeDiagnosticDetails } from './-iam-runtime-diagnostic-details';

describe('IamRuntimeDiagnosticDetails', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

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
            diagnosticStatus: 'manuelle_pruefung_erforderlich',
            recommendedAction: 'rollenabgleich_pruefen',
            requestId: 'req-known',
            safeDetails: { sync_error_code: 'IDP_FORBIDDEN' },
          } as never
        }
      />
    );

    expect(screen.getByText('Diagnose: Keycloak-Reconcile')).toBeTruthy();
    expect(screen.getByText('Status: Manuelle Prüfung erforderlich')).toBeTruthy();
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

  it('renders new auth, OIDC, frontend and legacy classifications', () => {
    render(
      <>
        <IamRuntimeDiagnosticDetails
          error={
            {
              name: 'IamHttpError',
              status: 500,
              code: 'internal_error',
              message: 'boom',
              classification: 'auth_resolution',
            } as never
          }
        />
        <IamRuntimeDiagnosticDetails
          error={
            {
              name: 'IamHttpError',
              status: 401,
              code: 'unauthorized',
              message: 'boom',
              classification: 'oidc_discovery_or_exchange',
            } as never
          }
        />
        <IamRuntimeDiagnosticDetails
          error={
            {
              name: 'IamHttpError',
              status: 409,
              code: 'conflict',
              message: 'boom',
              classification: 'frontend_state_or_permission_staleness',
            } as never
          }
        />
        <IamRuntimeDiagnosticDetails
          error={
            {
              name: 'IamHttpError',
              status: 500,
              code: 'internal_error',
              message: 'boom',
              classification: 'legacy_workaround_or_regression',
            } as never
          }
        />
      </>
    );

    expect(screen.getByText('Diagnose: Auth-Auflösung')).toBeTruthy();
    expect(screen.getByText('Diagnose: OIDC-Discovery oder Token-Austausch')).toBeTruthy();
    expect(screen.getByText('Diagnose: Frontend-State oder Berechtigungsstand veraltet')).toBeTruthy();
    expect(screen.getByText('Diagnose: Legacy-Workaround oder Regression')).toBeTruthy();
  });
});
