import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { InstanceDetailCockpitSection } from './-instance-detail-cockpit-section';
import { InstanceDetailConfigurationSection } from './-instance-detail-configuration-section';
import { InstanceDetailHistorySection } from './-instance-detail-history-section';
import { InstanceDetailOperationsSection } from './-instance-detail-operations-section';
import { InstanceDetailWorkspaceSections } from './-instance-detail-sections';

import type { ConfigurationSectionProps, OperationsSectionProps } from './-instance-detail-view-shared';

const { mockStudioModuleIamContracts } = vi.hoisted(() => ({
  mockStudioModuleIamContracts: [
    {
      moduleId: 'news',
      namespace: 'news',
      ownerPluginId: 'news',
      descriptionKey: 'plugins.news.description',
      permissionIds: ['news.read'],
      systemRoles: [],
    },
    {
      moduleId: 'events',
      namespace: 'events',
      ownerPluginId: 'events',
      descriptionKey: 'plugins.missing.description',
      permissionIds: ['events.read'],
      systemRoles: [],
    },
    {
      moduleId: 'poi',
      namespace: 'poi',
      ownerPluginId: 'poi',
      descriptionKey: 'plugins.empty.description',
      permissionIds: ['poi.read'],
      systemRoles: [],
    },
  ],
}));

vi.mock('../../../lib/plugins', () => ({
  studioModuleIamContracts: mockStudioModuleIamContracts,
}));

const createDetailFixture = (overrides: Record<string, unknown> = {}) =>
  ({
    instanceId: 'demo',
    displayName: 'Demo',
    status: 'requested',
    featureFlags: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    parentDomain: 'studio.example.org',
    primaryHostname: 'demo.studio.example.org',
    assignedModules: [],
    realmMode: 'new',
    authRealm: 'demo',
    authClientId: 'sva-studio-login',
    authClientSecretConfigured: false,
    tenantAdminClient: {
      clientId: 'sva-studio-realm-admin',
      secretConfigured: false,
    },
    tenantAdminBootstrap: {
      username: 'demo-admin',
      email: 'demo@example.org',
      firstName: 'Demo',
      lastName: 'Admin',
    },
    hostnames: [],
    provisioningRuns: [],
    auditEvents: [],
    keycloakPreflight: {
      overallStatus: 'ready',
      generatedAt: '2026-01-01T00:00:00.000Z',
      checkedAt: '2026-01-01T00:00:00.000Z',
      checks: [
        {
          checkKey: 'keycloak_admin_access',
          status: 'ready',
          title: 'Keycloak erreichbar',
          summary: 'Technischer Zugriff ist vorhanden.',
          details: {},
        },
      ],
    },
    keycloakPlan: {
      mode: 'new',
      overallStatus: 'ready',
      generatedAt: '2026-01-01T00:00:00.000Z',
      driftSummary: 'Kein Drift.',
      steps: [
        {
          stepKey: 'client',
          action: 'create',
          status: 'ready',
          title: 'Client anlegen',
          summary: 'Der Login-Client wird eingerichtet.',
          details: {},
        },
      ],
    },
    keycloakProvisioningRuns: [
      {
        id: 'run-history-1',
        instanceId: 'demo',
        intent: 'reset_tenant_admin',
        mode: 'existing',
        overallStatus: 'failed',
        driftSummary: 'Historischer Fehler',
        requestId: 'req-history-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        steps: [
          {
            stepKey: 'cleanup',
            title: 'Aufräumen',
            status: 'failed',
            summary: 'Abgebrochen',
            details: {},
          },
        ],
      },
    ],
    keycloakStatus: {
      realmExists: true,
      clientExists: true,
      tenantAdminClientExists: true,
      tenantAdminExists: true,
      tenantAdminHasSystemAdmin: true,
      tenantAdminHasInstanceRegistryAdmin: true,
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
      id: 'run-current',
      instanceId: 'demo',
      intent: 'provision',
      mode: 'new',
      overallStatus: 'running',
      driftSummary: 'Worker läuft.',
      requestId: 'req-current',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      steps: [],
    },
    moduleIamStatus: {
      overall: { status: 'degraded', summary: 'IAM-Basis unvollständig', source: 'registry' },
      modules: [
        {
          moduleId: 'news',
          status: 'blocked',
          summary: 'Berechtigungen fehlen',
          permissionIds: ['content.news.read'],
        },
      ],
    },
    tenantIamStatus: {
      configuration: { status: 'ready', summary: 'Konfiguration ok', source: 'registry' },
      access: {
        status: 'degraded',
        summary: 'Probe ausstehend',
        source: 'access_probe',
        requestId: 'req-access',
      },
      reconcile: { status: 'blocked', summary: 'Drift vorhanden', source: 'role_reconcile' },
      overall: { status: 'blocked', summary: 'Eingeschränkt', source: 'role_reconcile' },
    },
    ...overrides,
  }) as any;

const createDetailFormValues = () => ({
  displayName: 'Demo',
  parentDomain: 'studio.example.org',
  realmMode: 'new' as const,
  authRealm: 'demo',
  authClientId: 'sva-studio-login',
  authIssuerUrl: 'https://issuer.example.org/realms/demo',
  authClientSecret: '',
  tenantAdminClient: {
    clientId: 'sva-studio-realm-admin',
    secret: '',
  },
  tenantAdminBootstrap: {
    username: 'demo-admin',
    email: 'demo@example.org',
    firstName: 'Demo',
    lastName: 'Admin',
  },
  tenantAdminTemporaryPassword: '',
});

describe('instance detail split sections', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the cockpit split section and dispatches primary and secondary actions', () => {
    const onRunDetailAction = vi.fn().mockResolvedValue(undefined);

    render(
      <InstanceDetailCockpitSection
        selectedInstance={createDetailFixture()}
        configurationAssessment={{
          overallStatus: 'degraded',
          title: 'Konfiguration unvollständig',
          body: 'Es fehlen noch Angaben.',
          statusLabel: 'Teilweise',
          satisfiedRequirements: 3,
          totalRequirements: 5,
          blockingIssues: [],
          warningIssues: [],
        }}
        cockpitModel={{
          overallStatus: 'blocked',
          overallTitle: 'Blockiert',
          overallSummary: 'Weitere Schritte sind erforderlich.',
          dominantEvidence: {
            label: 'Tenant-IAM',
            source: 'role_reconcile',
            sourceLabel: 'Role-Reconcile',
            checkedAt: '2026-01-01T00:00:00.000Z',
            requestId: 'req-cockpit',
          },
          anomalyQueue: [
            {
              key: 'tenant-iam-access',
              title: 'Tenant-Zugriff',
              summary: 'Probe ausstehend',
              status: 'degraded',
              sourceLabel: 'Access Probe',
              checkedAt: '2026-01-01T00:00:00.000Z',
              requestId: 'req-anomaly',
            },
          ],
          primaryAction: {
            action: 'reconcileKeycloak',
            label: 'Realm abgleichen',
          },
          secondaryActions: [
            {
              action: 'check_preflight',
              label: 'Vorbedingungen prüfen',
            },
          ],
        }}
        mutationError={{ name: 'IamHttpError', status: 502, code: 'keycloak_unavailable', message: 'kaputt' }}
        onRunDetailAction={onRunDetailAction}
        statusLoading={false}
      />,
    );

    expect(screen.getAllByText('Weitere Schritte sind erforderlich.').length).toBeGreaterThan(0);
    expect(screen.getByText('Access Probe')).toBeTruthy();
    expect(screen.getByText(/Die Detailseite bleibt bedienbar/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Realm abgleichen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Vorbedingungen prüfen' }));

    expect(onRunDetailAction).toHaveBeenNthCalledWith(1, 'reconcileKeycloak');
    expect(onRunDetailAction).toHaveBeenNthCalledWith(2, 'check_preflight');
  });

  it('renders the configuration split section, updates controlled fields, and submits the form', () => {
    const onUpdateSubmit = vi.fn().mockImplementation(async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });
    let latestValues = createDetailFormValues();

    const Harness = () => {
      const [detailFormValues, setDetailFormValues] = React.useState(createDetailFormValues());
      latestValues = detailFormValues;

      return (
        <InstanceDetailConfigurationSection
          selectedInstance={createDetailFixture()}
          detailFormValues={detailFormValues}
          configurationAssessment={{
            overallStatus: 'incomplete',
            title: 'Konfiguration prüfen',
            body: 'Mehrere Pflichtangaben fehlen.',
            statusLabel: 'Unvollständig',
            satisfiedRequirements: 2,
            totalRequirements: 5,
            blockingIssues: [{ key: 'realm', label: 'Realm fehlt', severity: 'blocking' }],
            warningIssues: [{ key: 'issuer', label: 'Issuer prüfen', severity: 'warning' }],
          }}
          tenantSecretUserInputRequired={true}
          setDetailFormValues={setDetailFormValues as ConfigurationSectionProps['setDetailFormValues']}
          onUpdateSubmit={onUpdateSubmit}
          statusLoading={false}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getAllByRole('radio')[1] as HTMLInputElement);
    fireEvent.change(screen.getByLabelText('Anzeigename', { selector: '#detail-display-name' }), {
      target: { value: 'Demo Updated' },
    });
    fireEvent.change(screen.getByLabelText('Tenant-Client-Secret', { selector: '#detail-auth-client-secret' }), {
      target: { value: 'secret-1' },
    });
    fireEvent.change(screen.getByLabelText('Tenant-Admin-Client-ID', { selector: '#detail-tenant-admin-client-id' }), {
      target: { value: 'tenant-admin-2' },
    });
    fireEvent.change(screen.getByLabelText('Admin-E-Mail', { selector: '#detail-admin-email' }), {
      target: { value: 'updated@example.org' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Instanz speichern' }).closest('form') as HTMLFormElement);

    expect(screen.getByText(/Realm fehlt/)).toBeTruthy();
    expect(screen.getByText(/Issuer prüfen/)).toBeTruthy();
    expect(latestValues).toMatchObject({
      realmMode: 'existing',
      displayName: 'Demo Updated',
      authClientSecret: 'secret-1',
      tenantAdminClient: {
        clientId: 'tenant-admin-2',
      },
      tenantAdminBootstrap: {
        email: 'updated@example.org',
      },
    });
    expect(onUpdateSubmit).toHaveBeenCalledOnce();
  });

  it('renders the operations split section and dispatches workflow, provisioning, and module actions', () => {
    const onTriggerWorkflowAction = vi.fn().mockResolvedValue(undefined);
    const onExecuteProvisioning = vi.fn().mockResolvedValue(undefined);
    const onSeedIamBaseline = vi.fn().mockResolvedValue(undefined);
    let latestValues = createDetailFormValues();

    const Harness = () => {
      const [detailFormValues, setDetailFormValues] = React.useState(createDetailFormValues());
      latestValues = detailFormValues;

      return (
        <InstanceDetailOperationsSection
          selectedInstance={createDetailFixture()}
          detailFormValues={detailFormValues}
          effectiveTenantIamStatus={createDetailFixture().tenantIamStatus}
          mutationError={null}
          statusLoading={false}
          setDetailFormValues={setDetailFormValues as OperationsSectionProps['setDetailFormValues']}
          onTriggerWorkflowAction={onTriggerWorkflowAction}
          onExecuteProvisioning={onExecuteProvisioning}
          onSeedIamBaseline={onSeedIamBaseline}
        />
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Vorbedingungen prüfen' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Keycloak-Status prüfen' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Provisioning-Vorschau laden' })[0] as HTMLButtonElement);
    fireEvent.change(document.getElementById('tenant-admin-password') as HTMLInputElement, {
      target: { value: 'TempPasswort123!' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Provisioning ausführen' })[1] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tenant-Admin-Client bereitstellen' })[1] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tenant-Admin neu setzen' })[1] as HTMLButtonElement);
    fireEvent.click(screen.getAllByRole('button', { name: 'Client-Secret rotieren' })[1] as HTMLButtonElement);

    expect(screen.getByText('Probe ausstehend')).toBeTruthy();
    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('Client anlegen')).toBeTruthy();
    expect(onSeedIamBaseline).toHaveBeenCalledOnce();
    expect(onTriggerWorkflowAction).toHaveBeenCalledWith('check_preflight');
    expect(onTriggerWorkflowAction).toHaveBeenCalledWith('check_keycloak_status');
    expect(onTriggerWorkflowAction).toHaveBeenCalledWith('plan_provisioning');
    expect(onExecuteProvisioning).toHaveBeenCalledWith('provision');
    expect(onExecuteProvisioning).toHaveBeenCalledWith('provision_admin_client');
    expect(onExecuteProvisioning).toHaveBeenCalledWith('reset_tenant_admin');
    expect(onExecuteProvisioning).toHaveBeenCalledWith('rotate_client_secret');
    expect(latestValues.tenantAdminTemporaryPassword).toBe('TempPasswort123!');
  });

  it('renders the module transparency table with fallback descriptions for missing or empty translation values', () => {
    render(
      <InstanceDetailOperationsSection
        selectedInstance={createDetailFixture({
          assignedModules: ['news'],
          moduleIamStatus: undefined,
        })}
        detailFormValues={createDetailFormValues()}
        effectiveTenantIamStatus={createDetailFixture().tenantIamStatus}
        mutationError={null}
        statusLoading={false}
        setDetailFormValues={vi.fn() as OperationsSectionProps['setDetailFormValues']}
        onTriggerWorkflowAction={vi.fn().mockResolvedValue(undefined)}
        onExecuteProvisioning={vi.fn().mockResolvedValue(undefined)}
        onSeedIamBaseline={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('news')).toBeTruthy();
    expect(screen.getByText('events')).toBeTruthy();
    expect(screen.getByText('poi')).toBeTruthy();
    expect(screen.getAllByText('Aktiv')).toHaveLength(1);
    expect(screen.getAllByText('Deaktiviert')).toHaveLength(2);
    expect(screen.getByText('Veröffentlicht Nachrichten und redaktionelle Meldungen für den Mandanten.')).toBeTruthy();
    expect(screen.getAllByText('Keine Modulbeschreibung hinterlegt.')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'IAM-Basis neu aufbauen' })).toBeNull();
  });

  it('renders the history split section and loads a selected run on demand', () => {
    const onLoadProvisioningRun = vi.fn().mockResolvedValue(undefined);

    render(
      <InstanceDetailHistorySection
        selectedInstance={createDetailFixture({
          provisioningRuns: [{ id: 'local-run-1', operation: 'create_instance', status: 'active' }],
        })}
        onLoadProvisioningRun={onLoadProvisioningRun}
      />,
    );

    expect(screen.getByText('Historischer Fehler')).toBeTruthy();
    expect(screen.getByText('create_instance')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Run laden' }));

    expect(onLoadProvisioningRun).toHaveBeenCalledWith('run-history-1');
  });

  it('renders the workspace wrapper and switches between configuration, operations, and history tabs', () => {
    const onTriggerWorkflowAction = vi.fn().mockResolvedValue(undefined);
    const onExecuteProvisioning = vi.fn().mockResolvedValue(undefined);
    const onSeedIamBaseline = vi.fn().mockResolvedValue(undefined);
    const onLoadProvisioningRun = vi.fn().mockResolvedValue(undefined);
    const onUpdateSubmit = vi.fn().mockImplementation(async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    const Harness = () => {
      const [activeWorkspaceTab, setActiveWorkspaceTab] =
        React.useState<'configuration' | 'operations' | 'history'>('configuration');
      const [detailFormValues, setDetailFormValues] = React.useState(createDetailFormValues());

      return (
        <InstanceDetailWorkspaceSections
          activeWorkspaceTab={activeWorkspaceTab}
          selectedInstance={createDetailFixture()}
          detailFormValues={detailFormValues}
          configurationAssessment={{
            overallStatus: 'complete',
            title: 'Konfiguration ok',
            body: 'Alle Anforderungen sind erfüllt.',
            statusLabel: 'Vollständig',
            satisfiedRequirements: 5,
            totalRequirements: 5,
            blockingIssues: [],
            warningIssues: [],
          }}
          effectiveTenantIamStatus={createDetailFixture().tenantIamStatus}
          tenantSecretUserInputRequired={true}
          mutationError={null}
          statusLoading={false}
          setActiveWorkspaceTab={setActiveWorkspaceTab}
          setDetailFormValues={setDetailFormValues as ConfigurationSectionProps['setDetailFormValues']}
          onUpdateSubmit={onUpdateSubmit}
          onTriggerWorkflowAction={onTriggerWorkflowAction}
          onExecuteProvisioning={onExecuteProvisioning}
          onSeedIamBaseline={onSeedIamBaseline}
          onLoadProvisioningRun={onLoadProvisioningRun}
        />
      );
    };

    render(<Harness />);

    expect(screen.getByRole('tab', { name: 'Konfiguration' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByRole('button', { name: 'Instanz speichern' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Betrieb' }));
    expect(screen.getByRole('tab', { name: 'Betrieb' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByRole('button', { name: 'IAM-Basis neu aufbauen' })).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Historie' }));
    expect(screen.getByRole('tab', { name: 'Historie' }).getAttribute('data-state')).toBe('active');
    fireEvent.click(screen.getByRole('button', { name: 'Run laden' }));

    expect(onLoadProvisioningRun).toHaveBeenCalledWith('run-history-1');
  });
});
