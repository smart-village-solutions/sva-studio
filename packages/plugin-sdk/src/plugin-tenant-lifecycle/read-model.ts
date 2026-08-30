import type { TenantModuleActivationPolicy } from '@sva/core';
import type {
  PluginTenantAccessDecision,
  PluginTenantLifecycleReadEvidence,
  PluginTenantLifecycleRegistryEntry,
  PluginTenantReadinessCheckResult,
  PluginTenantReadinessReadModel,
  PluginTenantReadinessStatus,
} from './types.js';
import { reducePluginTenantReadinessStatus } from './snapshot.js';

const readinessStatusSet = new Set<string>(['pending', 'ready', 'degraded', 'blocked']);

export const evaluatePluginTenantAccess = (
  readiness: PluginTenantReadinessReadModel | null
): PluginTenantAccessDecision => {
  if (!readiness) return { allowed: false, reason: 'inactive' };
  if (readiness.accessState === 'suspended') return { allowed: false, reason: 'suspended' };
  if (readiness.evidenceState !== 'valid') {
    return {
      allowed: false,
      reason: readiness.evidenceState === 'invalid' ? 'evidence_invalid' : 'pending',
    };
  }
  return readiness.status === 'ready' || readiness.status === 'degraded'
    ? { allowed: true, reason: readiness.status }
    : { allowed: false, reason: readiness.status };
};

const readPersistedCheck = (
  value: Readonly<Record<string, unknown>>
): PluginTenantReadinessCheckResult | undefined => {
  const { checkId, status, messageKey, details } = value;
  if (
    typeof checkId !== 'string' ||
    typeof status !== 'string' ||
    !readinessStatusSet.has(status) ||
    (messageKey !== undefined && typeof messageKey !== 'string') ||
    (details !== undefined &&
      (typeof details !== 'object' || details === null || Array.isArray(details)))
  )
    return undefined;
  return {
    checkId,
    status: status as PluginTenantReadinessStatus,
    ...(messageKey === undefined ? {} : { messageKey }),
    ...(details === undefined ? {} : { details: details as Readonly<Record<string, unknown>> }),
  };
};

type ParsedEvidence = {
  readonly evidenceState: PluginTenantReadinessReadModel['evidenceState'];
  readonly status: PluginTenantReadinessStatus;
  readonly checks: PluginTenantReadinessReadModel['checks'];
};

const parseEvidence = (
  definition: PluginTenantLifecycleRegistryEntry,
  evidence: PluginTenantLifecycleReadEvidence | undefined
): ParsedEvidence => {
  const declaredCheckIds = new Set(definition.readinessChecks.map(({ checkId }) => checkId));
  const rawChecks = evidence?.readinessChecks ?? [];
  const parsedChecks = rawChecks.map(readPersistedCheck);
  const validChecks = parsedChecks.filter((check): check is PluginTenantReadinessCheckResult =>
    Boolean(check)
  );
  const persistedChecks = new Map(validChecks.map((check) => [check.checkId, check]));
  const evidenceInvalid = Boolean(
    evidence &&
    (validChecks.length !== rawChecks.length ||
      persistedChecks.size !== validChecks.length ||
      validChecks.some(({ checkId }) => !declaredCheckIds.has(checkId)) ||
      definition.readinessChecks.some(({ checkId }) => !persistedChecks.has(checkId)))
  );
  const missingRequiredCheck = definition.readinessChecks.some(
    ({ checkId, required }) => required && !persistedChecks.has(checkId)
  );
  return {
    evidenceState: evidence ? (evidenceInvalid ? 'invalid' : 'valid') : 'missing',
    status: evidenceInvalid
      ? missingRequiredCheck
        ? 'blocked'
        : 'degraded'
      : evidence
        ? reducePluginTenantReadinessStatus(definition, validChecks)
        : 'pending',
    checks: definition.readinessChecks.map((checkDefinition) => ({
      ...checkDefinition,
      ...(persistedChecks.get(checkDefinition.checkId) ?? {
        checkId: checkDefinition.checkId,
        status: 'pending' as const,
      }),
    })),
  };
};

const buildError = (
  evidenceState: PluginTenantReadinessReadModel['evidenceState'],
  evidence: PluginTenantLifecycleReadEvidence | undefined
): PluginTenantReadinessReadModel['error'] => {
  if (evidenceState === 'invalid') return { code: 'plugin_tenant_readiness_evidence_invalid' };
  if (!evidence?.errorCode) return undefined;
  return {
    code: evidence.errorCode,
    ...(evidence.retryKind ? { retryKind: evidence.retryKind } : {}),
    ...(evidence.retryAfter ? { retryAfter: evidence.retryAfter } : {}),
  };
};

export const createPluginTenantReadinessReadModel = (input: {
  readonly definition: PluginTenantLifecycleRegistryEntry;
  readonly activation: {
    readonly activationPolicy: TenantModuleActivationPolicy;
    readonly effectiveActive: boolean;
    readonly updatedAt: string;
  };
  readonly evidence?: PluginTenantLifecycleReadEvidence;
}): PluginTenantReadinessReadModel | null => {
  if (!input.activation.effectiveActive) return null;
  const parsed = parseEvidence(input.definition, input.evidence);
  const error = buildError(parsed.evidenceState, input.evidence);
  return {
    pluginId: input.definition.pluginId,
    activationPolicy: input.activation.activationPolicy,
    effectiveActive: true,
    accessState: input.evidence?.accessState ?? 'active',
    status: parsed.status,
    evidenceState: parsed.evidenceState,
    ...(input.evidence ? { desiredOperation: input.evidence.desiredOperation } : {}),
    desiredGeneration: input.evidence?.desiredGeneration ?? 0,
    completedGeneration: input.evidence?.completedGeneration ?? 0,
    ...(input.evidence?.activeJobId ? { activeJobId: input.evidence.activeJobId } : {}),
    ...(input.evidence?.readinessRevision ? { revision: input.evidence.readinessRevision } : {}),
    checks: parsed.checks,
    ...(error ? { error } : {}),
    updatedAt: input.evidence?.updatedAt ?? input.activation.updatedAt,
  };
};
