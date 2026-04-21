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
  const now = new Date().toISOString();
  const isTerminal = ['done', 'failed', 'skipped', 'unchanged'].includes(input.status);

  await deps.repository.appendKeycloakProvisioningStep({
    runId: input.runId,
    stepKey: input.stepKey,
    title: input.title,
    status: input.status,
    startedAt: input.status === 'pending' ? undefined : now,
    finishedAt: isTerminal ? now : undefined,
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
  details: { realmExists: status.realmExists, titleKey: 'iam.provisioning.steps.realm.title' },
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
    titleKey: 'iam.provisioning.steps.client.title',
  },
  ok: status.clientExists && status.redirectUrisMatch && status.logoutUrisMatch && status.webOriginsMatch,
});

const buildTenantAdminClientCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'tenant_admin_client',
  title: 'Tenant-Admin-Client abgleichen',
  summary: status.tenantAdminClientExists
    ? 'Der Tenant-Admin-Client ist vorhanden.'
    : 'Der Tenant-Admin-Client fehlt weiterhin.',
  details: {
    tenantAdminClientExists: status.tenantAdminClientExists,
    titleKey: 'iam.provisioning.steps.tenant_admin_client.title',
  },
  ok: status.tenantAdminClientExists,
});

const buildMapperCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'mapper',
  title: 'instanceId-Mapper sicherstellen',
  summary: status.instanceIdMapperExists
    ? 'Der instanceId-Mapper ist als Interop-Artefakt vorhanden.'
    : 'Der instanceId-Mapper fehlt als optionales Interop-Artefakt.',
  details: { instanceIdMapperExists: status.instanceIdMapperExists, titleKey: 'iam.provisioning.steps.mapper.title' },
  ok: true,
});

const buildSecretCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'secret',
  title: 'Tenant-Secret abgleichen',
  summary: status.clientSecretAligned
    ? 'Das Tenant-Secret ist mit Keycloak abgeglichen.'
    : 'Das Tenant-Secret ist weiterhin nicht mit Keycloak abgeglichen.',
  details: { clientSecretAligned: status.clientSecretAligned, titleKey: 'iam.provisioning.steps.secret.title' },
  ok: status.clientSecretAligned,
});

const buildTenantAdminClientSecretCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'tenant_admin_client_secret',
  title: 'Tenant-Admin-Client-Secret abgleichen',
  summary: status.tenantAdminClientSecretAligned
    ? 'Das Tenant-Admin-Client-Secret ist mit Keycloak abgeglichen.'
    : 'Das Tenant-Admin-Client-Secret ist weiterhin nicht mit Keycloak abgeglichen.',
  details: {
    tenantAdminClientSecretAligned: status.tenantAdminClientSecretAligned,
    titleKey: 'iam.provisioning.steps.tenant_admin_client_secret.title',
  },
  ok: status.tenantAdminClientSecretAligned,
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
    titleKey: 'iam.provisioning.steps.roles.title',
  },
  ok: status.tenantAdminHasSystemAdmin && !status.tenantAdminHasInstanceRegistryAdmin,
});

const buildTenantAdminCompletionStep = (status: KeycloakTenantStatus): CompletionStep => ({
  stepKey: 'tenant_admin',
  title: 'Tenant-Admin sicherstellen',
  summary:
    status.tenantAdminExists && status.tenantAdminInstanceIdMatches
      ? 'Der Tenant-Admin ist vorhanden und führt das optionale instanceId-Attribut.'
      : status.tenantAdminExists
        ? 'Der Tenant-Admin ist vorhanden; das optionale instanceId-Attribut weicht ab oder fehlt.'
        : 'Der Tenant-Admin fehlt weiterhin.',
  details: {
    tenantAdminExists: status.tenantAdminExists,
    tenantAdminInstanceIdMatches: status.tenantAdminInstanceIdMatches,
    titleKey: 'iam.provisioning.steps.tenant_admin.title',
  },
  ok: status.tenantAdminExists,
});

const buildTenantAdminPasswordStep = (usedTemporaryPassword: boolean): CompletionStep => ({
  stepKey: 'tenant_admin_password',
  title: 'Temporäres Passwort setzen',
  summary: usedTemporaryPassword
    ? 'Das temporäre Passwort wurde gesetzt und UPDATE_PASSWORD markiert.'
    : 'Es wurde kein temporäres Passwort übergeben.',
  details: { usedTemporaryPassword, titleKey: 'iam.provisioning.steps.tenant_admin_password.title' },
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
    buildTenantAdminClientCompletionStep(input.status),
    buildMapperCompletionStep(input.status),
    buildSecretCompletionStep(input.status),
    buildTenantAdminClientSecretCompletionStep(input.status),
    buildRolesCompletionStep(input.status),
    buildTenantAdminCompletionStep(input.status),
  ];

  if (input.usedTemporaryPassword || input.intent === 'reset_tenant_admin') {
    steps.push(buildTenantAdminPasswordStep(input.usedTemporaryPassword));
  }

  return steps;
};
