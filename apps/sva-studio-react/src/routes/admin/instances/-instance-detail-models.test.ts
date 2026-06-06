import { describe, expect, it } from 'vitest';

import {
  buildInstanceDoctorModel,
  buildExistingRealmOperationsModel,
  buildHistoryWorkspaceModel,
  buildNewRealmOperationsModel,
  buildOperationsPrimaryAction,
  evaluateInstanceConfiguration,
  getOperationsActionLabel,
  getOperationsEvidenceSourceLabel,
} from './-instance-detail-models';
import { OperationsStepStatusBadge } from './-instance-status-badges';

describe('instance detail split module exports', () => {
  it('exposes the operations and history builders through the split models entry', () => {
    expect(buildNewRealmOperationsModel).toBeTypeOf('function');
    expect(buildExistingRealmOperationsModel).toBeTypeOf('function');
    expect(buildOperationsPrimaryAction).toBeTypeOf('function');
    expect(buildHistoryWorkspaceModel).toBeTypeOf('function');
    expect(getOperationsActionLabel).toBeTypeOf('function');
    expect(getOperationsEvidenceSourceLabel).toBeTypeOf('function');
  });

  it('exposes the operations status badge through the shared badge module', () => {
    expect(OperationsStepStatusBadge).toBeTypeOf('function');
  });

  it('builds a doctor model that mixes green and non-green checks from existing evidence', () => {
    const instance = {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      realmMode: 'existing',
      authRealm: 'demo',
      authClientId: 'sva-studio-login',
      authClientSecretConfigured: true,
      tenantAdminClient: {
        clientId: 'sva-studio-realm-admin',
        secretConfigured: true,
      },
      tenantAdminBootstrap: {
        username: 'demo-admin',
        email: 'demo@example.org',
        firstName: 'Demo',
        lastName: 'Admin',
      },
      hostnames: [],
      assignedModules: [],
      provisioningRuns: [],
      auditEvents: [],
      keycloakPreflight: {
        overallStatus: 'warning',
        checkedAt: '2026-01-01T00:00:00.000Z',
        checks: [
          {
            checkKey: 'keycloak_admin_access',
            status: 'warning',
            title: 'Technischer Zugriff',
            summary: 'Der Zugriff muss erneut geprüft werden.',
            details: {},
          },
        ],
      },
      keycloakPlan: {
        mode: 'existing',
        overallStatus: 'ready',
        generatedAt: '2026-01-01T00:00:00.000Z',
        driftSummary: 'Kein Drift.',
        steps: [],
      },
      keycloakStatus: {
        realmExists: true,
        clientExists: true,
        tenantAdminClientExists: true,
        tenantAdminExists: true,
        tenantAdminHasSystemAdmin: true,
        redirectUrisMatch: true,
        logoutUrisMatch: true,
        webOriginsMatch: true,
        clientSecretConfigured: true,
        tenantClientSecretReadable: true,
        clientSecretAligned: true,
        tenantAdminClientSecretConfigured: true,
        tenantAdminClientSecretReadable: true,
        tenantAdminClientSecretAligned: true,
        runtimeSecretSource: 'tenant',
      },
      latestKeycloakProvisioningRun: {
        id: 'run-1',
        intent: 'provision',
        mode: 'existing',
        overallStatus: 'failed',
        driftSummary: 'Der letzte Lauf ist fehlgeschlagen.',
        requestId: 'req-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        steps: [],
      },
      keycloakProvisioningRuns: [],
      tenantIamStatus: {
        configuration: { status: 'ready', summary: 'Konfiguration ok', source: 'registry' },
        access: { status: 'degraded', summary: 'Probe ausstehend', source: 'access_probe' },
        reconcile: { status: 'blocked', summary: 'Drift vorhanden', source: 'role_reconcile' },
        overall: { status: 'blocked', summary: 'Handlungsbedarf', source: 'role_reconcile' },
      },
    } as any;

    const operationsModel = buildExistingRealmOperationsModel(instance, null);
    const primaryAction = buildOperationsPrimaryAction(operationsModel);
    const configurationAssessment = evaluateInstanceConfiguration(instance, null);
    const doctorModel = buildInstanceDoctorModel({
      instance,
      configurationAssessment,
      mutationError: null,
      operationsModel,
      primaryAction,
    });

    expect(doctorModel.checks.some((check) => check.status === 'ready')).toBe(true);
    expect(doctorModel.checks.some((check) => check.status === 'blocked' || check.status === 'degraded')).toBe(true);
    expect(doctorModel.recommendedAction.label.length).toBeGreaterThan(0);
    expect(doctorModel.validationState).toBe('blocked');
    expect(doctorModel.warning?.title).toBe('Doctor erkennt aktuell Handlungsbedarf.');
  });
});
