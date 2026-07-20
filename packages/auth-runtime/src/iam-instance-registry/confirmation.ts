import { createHash } from 'node:crypto';

import { getWorkspaceContext } from '@sva/server-runtime';
import type { InstanceRegistryService } from '@sva/instance-registry';

import { createApiError } from '../iam-account-management/api-helpers.js';
import { jsonResponse } from '../db.js';

import { isRegistryServiceContext, type RegistryRequestContext } from './auth-context.js';
import { ensurePlatformAccess } from './http.js';
import { withScopedRegistryService } from './repository.js';

export const CRITICAL_REGISTRY_ACTIONS = [
  'instance.status.activate',
  'instance.status.suspend',
  'instance.status.archive',
  'instance.module.revoke',
  'instance.secret.rotate',
] as const;

type CriticalRegistryAction = (typeof CRITICAL_REGISTRY_ACTIONS)[number];
const criticalActions = new Set<string>(CRITICAL_REGISTRY_ACTIONS);

export const validateConfirmationModuleId = (actionId: string, moduleId?: string): boolean =>
  actionId === 'instance.module.revoke' ? Boolean(moduleId?.trim()) : moduleId === undefined;

export const fingerprintInstanceConfirmationState = (instance: {
  readonly instanceId: string;
  readonly updatedAt: string;
  readonly status: string;
  readonly assignedModules: readonly string[];
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly realmMode: string;
  readonly authRealm: string;
  readonly authClientId: string;
  readonly authIssuerUrl?: string;
  readonly authClientSecretConfigured: boolean;
  readonly tenantAdminClient?: { readonly clientId: string; readonly secretConfigured: boolean };
}): string => {
  const featureFlags = Object.fromEntries(Object.entries(instance.featureFlags).sort(([left], [right]) => left.localeCompare(right)));
  const stableState = {
    instanceId: instance.instanceId,
    updatedAt: instance.updatedAt,
    status: instance.status,
    assignedModules: [...instance.assignedModules].sort(),
    featureFlags,
    realmMode: instance.realmMode,
    authRealm: instance.authRealm,
    authClientId: instance.authClientId,
    authIssuerUrl: instance.authIssuerUrl,
    authClientSecretConfigured: instance.authClientSecretConfigured,
    tenantAdminClient: instance.tenantAdminClient,
  };
  return createHash('sha256').update(JSON.stringify(stableState)).digest('hex');
};

const phraseFor = (actionId: CriticalRegistryAction, instanceId: string, moduleId?: string): string => {
  if (actionId === 'instance.module.revoke') return `REVOKE ${moduleId ?? 'MODULE'} FROM ${instanceId}`;
  if (actionId === 'instance.secret.rotate') return `ROTATE SECRET FOR ${instanceId}`;
  const segments = actionId.split('.');
  return `${segments[segments.length - 1]?.toUpperCase()} ${instanceId}`;
};

const loadFingerprint = async (service: InstanceRegistryService, instanceId: string): Promise<string | null> => {
  const instance = await service.getInstanceDetail(instanceId);
  return instance ? fingerprintInstanceConfirmationState(instance) : null;
};

export const confirmCriticalRegistryMutation = async (input: {
  readonly service: InstanceRegistryService;
  readonly request: Request;
  readonly context: RegistryRequestContext;
  readonly instanceId: string;
  readonly actorId: string;
  readonly actionId: string;
  readonly moduleId?: string;
}): Promise<Response | null> => {
  if (!isRegistryServiceContext(input.context)) return null;
  const requestId = getWorkspaceContext().requestId;
  const challengeId = input.request.headers.get('x-confirmation-challenge-id');
  const confirmationPhrase = input.request.headers.get('x-confirmation-phrase');
  if (!challengeId || !confirmationPhrase) {
    return createApiError(403, 'confirmation_required' as Parameters<typeof createApiError>[1], 'Bestätigung für kritische Aktion erforderlich.', requestId);
  }
  const stateFingerprint = await loadFingerprint(input.service, input.instanceId);
  if (!stateFingerprint) return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
  const consumed = await input.service.consumeConfirmationChallenge({
    challengeId,
    instanceId: input.instanceId,
    actorId: input.actorId,
    actionId: input.actionId,
    ...(input.moduleId ? { moduleId: input.moduleId } : {}),
    stateFingerprint,
    confirmationPhrase,
  });
  return consumed ? null : createApiError(409, 'invalid_confirmation' as Parameters<typeof createApiError>[1], 'Bestätigung ist ungültig oder abgelaufen.', requestId);
};

export const prepareInstanceConfirmationInternal = async (
  request: Request,
  context: RegistryRequestContext
): Promise<Response> => {
  const requestId = getWorkspaceContext().requestId;
  if (!isRegistryServiceContext(context)) {
    return createApiError(403, 'forbidden', 'Maschinen-Authentisierung erforderlich.', requestId);
  }
  const accessError = ensurePlatformAccess(request, context);
  if (accessError) return accessError;
  const url = new URL(request.url);
  const match = /\/instances\/([^/]+)\/actions\/([^/]+)\/confirmation$/u.exec(url.pathname);
  const instanceId = match?.[1] ? decodeURIComponent(match[1]) : undefined;
  const actionId = match?.[2] ? decodeURIComponent(match[2]) : undefined;
  if (!instanceId || !actionId || !criticalActions.has(actionId)) {
    return createApiError(400, 'invalid_request', 'Ungültige kritische Aktion.', requestId);
  }
  const rawModuleId = url.searchParams.get('moduleId') ?? undefined;
  const moduleId = rawModuleId?.trim() || undefined;
  if (!validateConfirmationModuleId(actionId, moduleId)) {
    return createApiError(400, 'invalid_request', 'Modul-ID ist für den Modulentzug erforderlich.', requestId);
  }
  return withScopedRegistryService(instanceId, async (service) => {
    const stateFingerprint = await loadFingerprint(service, instanceId);
    if (!stateFingerprint) return createApiError(404, 'not_found', 'Instanz wurde nicht gefunden.', requestId);
    const confirmationPhrase = phraseFor(actionId as CriticalRegistryAction, instanceId, moduleId);
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    const challenge = await service.prepareConfirmationChallenge({
      instanceId,
      actorId: context.user.id,
      actionId,
      ...(moduleId ? { moduleId } : {}),
      stateFingerprint,
      confirmationPhrase,
      expiresAt,
      ...(requestId ? { requestId } : {}),
    });
    return jsonResponse(201, {
      data: {
        challengeId: challenge.challengeId,
        actionId,
        instanceId,
        ...(moduleId ? { moduleId } : {}),
        stateVersion: stateFingerprint,
        expiresAt,
        confirmationPhrase,
        impactSummary: confirmationPhrase,
      },
      requestId,
    });
  });
};
