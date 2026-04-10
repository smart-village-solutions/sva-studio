import type { ExecuteInstanceKeycloakProvisioningInput } from './mutation-types.js';
import type { KeycloakTenantStatus } from './keycloak-types.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';

export const appendRunStep = async (deps: InstanceRegistryServiceDeps, input: {
  runId: string;
  stepKey: string;
  title: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped' | 'unchanged';
  summary: string;
  details?: Readonly<Record<string, unknown>>;
  requestId?: string;
}) => {
  const timestamp = new Date().toISOString();
  await deps.repository.appendKeycloakProvisioningStep({
    runId: input.runId,
    stepKey: input.stepKey,
    title: input.title,
    status: input.status,
    startedAt: timestamp,
    finishedAt: timestamp,
    summary: input.summary,
    details: input.details,
    requestId: input.requestId,
  });
};

type CompletionStep = {
  stepKey: string;
  title: string;
  summary: string;
  details?: Readonly<Record<string, unknown>>;
  ok: boolean;
};

const buildRealmCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'realm',
  title: 'Realm bearbeiten',
  summary: status.realmExists ? 'Der Realm ist vorhanden.' : 'Der Realm fehlt weiterhin.',
  details: { realmExists: status.realmExists },
  ok: status.realmExists,
});

const buildClientCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'client',
  title: 'OIDC-Client abgleichen',
  summary:
    status.clientExists && status.redirectUrisMatch && status.logoutUrisMatch && status.webOriginsMatch
      ? 'Der OIDC-Client entspricht dem Sollzustand.'
      : 'Der OIDC-Client weicht weiterhin vom Sollzustand ab.',
  details: {
    clientExists: status.clientExists,
    redirectUrisMatch: status.redirectUrisMatch,
    logoutUrisMatch: status.logoutUrisMatch,
    webOriginsMatch: status.webOriginsMatch,
  },
  ok: status.clientExists && status.redirectUrisMatch && status.logoutUrisMatch && status.webOriginsMatch,
});

const buildMapperCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'mapper',
  title: 'instanceId-Mapper sicherstellen',
  summary: status.instanceIdMapperExists
    ? 'Der instanceId-Mapper ist vorhanden.'
    : 'Der instanceId-Mapper fehlt weiterhin.',
  details: { instanceIdMapperExists: status.instanceIdMapperExists },
  ok: status.instanceIdMapperExists,
});

const buildSecretCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'secret',
  title: 'Tenant-Secret abgleichen',
  summary: status.clientSecretAligned
    ? 'Das Tenant-Secret ist mit Keycloak abgeglichen.'
    : 'Das Tenant-Secret ist weiterhin nicht mit Keycloak abgeglichen.',
  details: { clientSecretAligned: status.clientSecretAligned },
  ok: status.clientSecretAligned,
});

const buildRolesCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'roles',
  title: 'Realm-Rollen sicherstellen',
  summary:
    status.tenantAdminHasSystemAdmin && !status.tenantAdminHasInstanceRegistryAdmin
      ? 'Die Tenant-Admin-Rollen entsprechen dem Minimalprofil.'
      : 'Die Tenant-Admin-Rollen weichen vom Minimalprofil ab.',
  details: {
    tenantAdminHasSystemAdmin: status.tenantAdminHasSystemAdmin,
    tenantAdminHasInstanceRegistryAdmin: status.tenantAdminHasInstanceRegistryAdmin,
  },
  ok: status.tenantAdminHasSystemAdmin && !status.tenantAdminHasInstanceRegistryAdmin,
});

const buildTenantAdminCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'tenant_admin',
  title: 'Tenant-Admin sicherstellen',
  summary: status.tenantAdminExists ? 'Der Tenant-Admin ist vorhanden.' : 'Der Tenant-Admin fehlt weiterhin.',
  details: { tenantAdminExists: status.tenantAdminExists },
  ok: status.tenantAdminExists,
});

const buildTenantAdminPasswordStep = (usedTemporaryPassword: boolean): CompletionStep => ({
  stepKey: 'tenant_admin_password',
  title: 'Temporäres Passwort setzen',
  summary: usedTemporaryPassword
    ? 'Das temporäre Passwort wurde gesetzt und UPDATE_PASSWORD markiert.'
    : 'Es wurde kein temporäres Passwort übergeben.',
  details: { usedTemporaryPassword },
  ok: usedTemporaryPassword,
});

export const buildFinalRunSteps = (input: {
  status: KeycloakTenantStatus;
  intent: ExecuteInstanceKeycloakProvisioningInput['intent'];
  usedTemporaryPassword: boolean;
}): CompletionStep[] => {
  const steps: CompletionStep[] = [
    buildRealmCompletionStep(input.status),
    buildClientCompletionStep(input.status),
    buildMapperCompletionStep(input.status),
    buildSecretCompletionStep(input.status),
    buildRolesCompletionStep(input.status),
    buildTenantAdminCompletionStep(input.status),
  ];

  if (input.usedTemporaryPassword || input.intent === 'reset_tenant_admin') {
    steps.push(buildTenantAdminPasswordStep(input.usedTemporaryPassword));
  }

  return steps;
};
