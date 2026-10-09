import { isInstanceTenantAdminRequired, type InstanceRealmMode } from '@sva/core';

import type { KeycloakTenantPlan, KeycloakTenantPreflight } from './keycloak-types.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';
import {
  readClientAlignment,
  readTenantAdminClientAlignment,
} from './provisioning-auth-client-alignment.js';
import { readStudioOwnedClient } from './provisioning-auth-policy.js';
import { buildPluginOidcClientStep } from './provisioning-auth-plugin-clients.js';
import { buildRealmBaselinePlanSteps } from './keycloak-realm-baseline.js';
import { buildPayloadFingerprint } from './payload-fingerprint.js';
import {
  buildRealmStep,
  buildClientStep,
  buildTenantAdminClientStep,
  buildSecretStep,
  buildTenantAdminClientSecretStep,
  buildRoleStep,
  buildTenantAdminStep,
} from './provisioning-auth-plan-steps.js';

export const KEYCLOAK_PLAN_CONTRACT_VERSION = '1.0' as const;

type BuildPlanInput = {
  instanceId: string;
  realmMode: InstanceRealmMode;
  authClientSecret?: string;
  tenantAdminClient?: {
    clientId: string;
    secretConfigured?: boolean;
  };
  tenantAdminClientSecret?: string;
  tenantAdminBootstrap?: KeycloakProvisioningInput['tenantAdminBootstrap'];
  pluginOidcClients?: KeycloakProvisioningInput['pluginOidcClients'];
  realmBaselineApplicable?: boolean;
  preflight: KeycloakTenantPreflight;
  state?: KeycloakReadState;
};

export const buildKeycloakPlanFingerprint = (
  instanceId: string,
  plan: Pick<
    KeycloakTenantPlan,
    'contractVersion' | 'mode' | 'overallStatus' | 'driftSummary' | 'steps'
  >
): string =>
  buildPayloadFingerprint({
    instanceId,
    contractVersion: plan.contractVersion,
    mode: plan.mode,
    overallStatus: plan.overallStatus,
    driftSummary: plan.driftSummary,
    steps: plan.steps,
  });

export const buildPlan = (input: BuildPlanInput): KeycloakTenantPlan => {
  const blocked = input.preflight.overallStatus === 'blocked';
  const realmBaselineApplicable = input.realmBaselineApplicable ?? input.realmMode === 'new';
  const requireTenantAdmin = isInstanceTenantAdminRequired(input);
  const steps = buildPlanSteps(input, blocked, realmBaselineApplicable, requireTenantAdmin);
  const planBlocked = blocked || steps.some((step) => step.status === 'blocked');

  const plan: Omit<KeycloakTenantPlan, 'fingerprint' | 'generatedAt'> = {
    contractVersion: KEYCLOAK_PLAN_CONTRACT_VERSION,
    mode: input.realmMode,
    overallStatus: planBlocked ? 'blocked' : 'ready',
    driftSummary: resolveDriftSummary(planBlocked, steps),
    steps,
  };
  return {
    ...plan,
    fingerprint: buildKeycloakPlanFingerprint(input.instanceId, plan),
    generatedAt: new Date().toISOString(),
  };
};

const buildPlanSteps = (
  input: BuildPlanInput,
  blocked: boolean,
  realmBaselineApplicable: boolean,
  requireTenantAdmin: boolean
): KeycloakTenantPlan['steps'] => {
  const alignment = readClientAlignment(input.state);
  const tenantAdminClientAlignment = readTenantAdminClientAlignment(input.state);
  const clientOwnershipConflict =
    Boolean(alignment.clientRepresentation) &&
    readStudioOwnedClient(alignment.clientRepresentation, input.instanceId, 'login_client') !==
      'owned';
  const tenantAdminClientOwnershipConflict =
    Boolean(tenantAdminClientAlignment.clientRepresentation) &&
    readStudioOwnedClient(
      tenantAdminClientAlignment.clientRepresentation,
      input.instanceId,
      'tenant_admin_client'
    ) !== 'owned';
  const secretAligned = Boolean(
    input.authClientSecret &&
    input.state?.keycloakClientSecret &&
    input.authClientSecret === input.state.keycloakClientSecret
  );
  const tenantAdminClientSecretAligned = Boolean(
    input.tenantAdminClientSecret &&
    input.state?.tenantAdminClientSecret &&
    input.tenantAdminClientSecret === input.state.tenantAdminClientSecret
  );
  const pluginOidcClients =
    input.pluginOidcClients ??
    input.state?.pluginOidcClients.map(({ requirement }) => requirement) ??
    [];

  return [
    buildRealmStep(input.realmMode, input.state, blocked),
    ...buildRealmBaselinePlanSteps(input.state, blocked, realmBaselineApplicable),
    buildClientStep({
      blocked,
      clientExists: Boolean(alignment.clientRepresentation),
      redirectUrisMatch: alignment.redirectUrisMatch,
      logoutUrisMatch: alignment.logoutUrisMatch,
      webOriginsMatch: alignment.webOriginsMatch,
      ownershipConflict: clientOwnershipConflict,
    }),
    buildTenantAdminClientStep({
      blocked,
      clientExists: Boolean(tenantAdminClientAlignment.clientRepresentation),
      directAccessGrantsEnabledMatch: tenantAdminClientAlignment.directAccessGrantsEnabledMatch,
      rootUrlMatch: tenantAdminClientAlignment.rootUrlMatch,
      redirectUrisMatch: tenantAdminClientAlignment.redirectUrisMatch,
      logoutUrisMatch: tenantAdminClientAlignment.logoutUrisMatch,
      serviceAccountsEnabledMatch: tenantAdminClientAlignment.serviceAccountsEnabledMatch,
      standardFlowEnabledMatch: tenantAdminClientAlignment.standardFlowEnabledMatch,
      webOriginsMatch: tenantAdminClientAlignment.webOriginsMatch,
      ownershipConflict: tenantAdminClientOwnershipConflict,
      serviceAccess: input.state?.tenantAdminServiceAccess,
    }),
    ...pluginOidcClients.map((requirement) =>
      buildPluginOidcClientStep(requirement, input.state, blocked, input.instanceId)
    ),
    buildSecretStep(blocked, secretAligned, clientOwnershipConflict),
    buildTenantAdminClientSecretStep(
      blocked,
      Boolean(input.tenantAdminClient?.clientId),
      tenantAdminClientSecretAligned,
      tenantAdminClientOwnershipConflict
    ),
    buildRoleStep(blocked, input.state, input.instanceId),
    buildTenantAdminStep(
      blocked,
      input.state,
      requireTenantAdmin,
      input.instanceId,
      input.tenantAdminBootstrap
    ),
  ];
};

const resolveDriftSummary = (
  blocked: boolean,
  steps: KeycloakTenantPlan['steps']
): KeycloakTenantPlan['driftSummary'] => {
  if (blocked) {
    return 'Provisioning ist blockiert, bis die Vorbedingungen erfüllt sind.';
  }

  const requiresChanges = steps.some(
    (step: KeycloakTenantPlan['steps'][number]) =>
      step.action !== 'verify' && step.action !== 'skip'
  );
  return requiresChanges
    ? 'Keycloak und Registry weisen Drift auf und werden beim nächsten Lauf abgeglichen.'
    : 'Keycloak entspricht bereits dem im Studio gepflegten Sollzustand.';
};
