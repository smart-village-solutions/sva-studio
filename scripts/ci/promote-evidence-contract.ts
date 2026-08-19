import { parseAppE2EEvidence } from './app-e2e-evidence.ts';
import {
  buildPromoteFailure,
  parsePromoteFailure,
  type PromoteEnvironment,
  type PromoteFailure,
  type PromotePhase,
} from './promote-result.ts';
import { projectRecoveryEvidence } from './promote-recovery-contract.ts';
import { normalizeEvidenceSeedAuthorization } from './promote-evidence-seed.ts';
import { normalizeEvidenceSeedPreparation } from './promote-evidence-seed-preparation.ts';
import { normalizePromoteMode, normalizeReasonProvided } from './promote-evidence-values.ts';
import type {
  BuildPromoteEvidenceInput,
  PromoteBackupAgentEvidence,
  PromoteEvidence,
  PromoteEvidenceStatus,
  PromoteGateEvidence,
  PromoteGateName,
  PromoteGateStatus,
  PromoteMainE2EReference,
} from './promote-evidence-types.ts';

const shaPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;
const digestPattern = /sha256:[0-9a-f]{64}/u;
const revisionPattern = /^[0-9a-f]{64}$/u;
const gitRefPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;
const safeReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/u;
const safeFieldPattern = /^[a-z][A-Za-z0-9_-]{0,63}$/u;
const imageRevisionPattern =
  /^(?:[0-9a-f]{40}|[0-9a-f]{64}|sha256:[0-9a-f]{64}|[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})$/u;
const backupAgentRevisionPattern =
  /^(?:[0-9a-f]{40}|[0-9a-f]{64}|[A-Za-z0-9._/-]+@sha256:[0-9a-f]{64})$/u;
const gateStatuses: readonly PromoteGateStatus[] = ['passed', 'failed', 'cancelled', 'skipped'];
const evidenceStatuses: readonly PromoteEvidenceStatus[] = ['passed', 'failed', 'cancelled'];
const evidenceEnvironments: readonly PromoteEnvironment[] = ['dev', 'staging', 'prod', 'invalid'];
const gateNames = new Set<PromoteGateName>([
  'workspace-setup',
  'input-validation',
  'permission-snapshot-secret',
  'worker-database-secret',
  'source-preparation',
  'source-contract',
  'deployment-base',
  'registry-login',
  'image-contract',
  'main-e2e-evidence',
  'legacy-config-seed-preparation',
  'legacy-config-seed',
  'legacy-config-seed-recheck',
  'recovery-contract',
  'config-build',
  'config-revision-contract',
  'worker-database-secret-injection',
  'change-policy-evaluation',
  'migration-bootstrap-policy',
  'deployment-tooling',
  'target-resolution',
  'readiness',
  'previous-live-capture',
  'candidate-preflight',
  'staging-parity',
  'backup-capabilities',
  'studio-backup-request',
  'waste-backup-request',
  'temporary-backup',
  'studio-backup-verification',
  'waste-backup-verification',
  'migration',
  'bootstrap',
  'postconditions',
  'deploy',
  'swarm-convergence',
  'runtime-smoke',
  'digest-verification',
  'staging-parity-evidence',
  'staging-parity-upload',
  'one-shot-evidence-upload',
  'config-cleanup',
]);
const evidencePhases = new Set<PromotePhase>([
  'input-validation',
  'source-contract',
  'image-contract',
  'main-e2e-evidence',
  'config-build',
  'static-preflight',
  'candidate-preflight',
  'staging-parity',
  'backup-capabilities',
  'backup',
  'migration',
  'bootstrap',
  'postconditions',
  'deploy',
  'swarm-convergence',
  'external-smoke',
  'digest-verification',
  'evidence',
]);

export const assertGitRef = (value: string, label: string): string => {
  if (!gitRefPattern.test(value) || value.includes('..') || value.includes('@{'))
    throw new Error(`${label} verletzt den redigierten Evidenzvertrag.`);
  return value;
};

export const normalizeWorkflowRef = (value: string | undefined): string => {
  if (!value?.trim()) return 'invalid-ref';
  try {
    return assertGitRef(value, 'Git-Ref');
  } catch {
    return 'invalid-ref';
  }
};

const assertRunId = (value: string): string => {
  if (!/^\d+$/u.test(value)) throw new Error('Run-ID verletzt den Evidenzvertrag.');
  return value;
};
const assertSafeField = (value: string, label: string): string => {
  if (!safeFieldPattern.test(value)) throw new Error(`${label} verletzt den Evidenzvertrag.`);
  return value;
};
const assertImageRevision = (value: string): string => {
  if (!imageRevisionPattern.test(value))
    throw new Error('Image-Revision verletzt den Evidenzvertrag.');
  return value;
};
const assertBackupAgentRevision = (value: string): string => {
  if (!backupAgentRevisionPattern.test(value))
    throw new Error('Agent-Revision verletzt den Evidenzvertrag.');
  return value;
};
const assertSha = (value: string, label: string): string => {
  if (!shaPattern.test(value)) throw new Error(`${label} ist kein vollständiges Git-SHA.`);
  return value;
};
const normalizeDigest = (value: string | null | undefined): string | null => {
  if (!value?.trim() || value === 'not-pinned' || value === 'not-evaluated') return null;
  const match = value.match(digestPattern);
  if (!match) throw new Error('Image-Digest verletzt den Evidenzvertrag.');
  return match[0];
};
const normalizeConfigRevision = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;
  if (!revisionPattern.test(value)) throw new Error('Config-Revision verletzt den Evidenzvertrag.');
  return value;
};

const normalizeBackupAgent = (
  value: PromoteBackupAgentEvidence | null | undefined
): PromoteBackupAgentEvidence | null => {
  if (!value) return null;
  const validLists =
    Array.isArray(value.protocolVersions) &&
    value.protocolVersions.every((version) => Number.isSafeInteger(version) && version > 0) &&
    Array.isArray(value.databaseTargets) &&
    Array.isArray(value.resultFields);
  if (!validLists) throw new Error('Backup-Agent-Evidenz ist ungültig.');
  return {
    agentRevision: assertBackupAgentRevision(value.agentRevision),
    protocolVersions: [...value.protocolVersions].sort((left, right) => left - right),
    databaseTargets: [
      ...new Set(value.databaseTargets.map((target) => assertSafeField(target, 'Datenbankziel'))),
    ].sort(),
    resultFields: [
      ...new Set(value.resultFields.map((field) => assertSafeField(field, 'Ergebnisfeld'))),
    ].sort(),
    wasteInventory: value.wasteInventory === true,
  };
};

const normalizeMainE2EReference = (
  value: unknown,
  expectedHeadSha: string | null | undefined,
  gatePassed: boolean
): PromoteMainE2EReference | null => {
  if (!gatePassed || !expectedHeadSha?.trim() || !shaPattern.test(expectedHeadSha)) return null;
  const evidence = parseAppE2EEvidence(value);
  const valid =
    evidence?.headSha === expectedHeadSha &&
    evidence.result === 'success' &&
    evidence.testOutcome === 'success' &&
    evidence.evidenceClass === 'canonical-main';
  if (!evidence || !valid) return null;
  return {
    run: { id: evidence.run.id, attempt: evidence.run.attempt },
    headSha: evidence.headSha,
    result: 'success',
    testOutcome: 'success',
    evidenceClass: 'canonical-main',
  };
};

const normalizeGate = (gate: BuildPromoteEvidenceInput['gates'][number]): PromoteGateEvidence => {
  if (!gateStatuses.includes(gate.status)) throw new Error('Gate-Status ist ungültig.');
  if (!gateNames.has(gate.gate)) throw new Error('Gate-Name ist ungültig.');
  if (!evidencePhases.has(gate.phase)) throw new Error('Gate-Phase ist ungültig.');
  return {
    gate: gate.gate,
    phase: gate.phase,
    status: gate.status,
    blocking: gate.blocking !== false,
  };
};

const selectTerminalFailure = (
  input: BuildPromoteEvidenceInput,
  firstFailedPhase: PromotePhase | undefined
): PromoteFailure | null => {
  if (input.status === 'passed') return null;
  const failure = parsePromoteFailure(input.recordedFailure);
  const matching =
    failure?.environment === input.environment &&
    (!firstFailedPhase || failure.phase === firstFailedPhase);
  return matching && failure
    ? failure
    : buildPromoteFailure({
        code: 'PROMOTE_INTERNAL_ERROR',
        environment: input.environment,
        phase: firstFailedPhase ?? 'evidence',
      });
};

const normalizeSecretReferences = (values: readonly string[] | undefined): string[] =>
  [
    ...new Set(
      (values ?? []).map((reference) => {
        if (!safeReferencePattern.test(reference))
          throw new Error('Secret-Referenz verletzt den Evidenzvertrag.');
        return reference;
      })
    ),
  ].sort();

export const buildPromoteEvidence = (input: BuildPromoteEvidenceInput): PromoteEvidence => {
  if (!Number.isSafeInteger(input.runAttempt) || input.runAttempt < 1)
    throw new Error('Run-Attempt ist ungültig.');
  if (!evidenceEnvironments.includes(input.environment))
    throw new Error('Environment ist ungültig.');
  if (!evidenceStatuses.includes(input.status)) throw new Error('Evidenzstatus ist ungültig.');
  const gates = input.gates.map(normalizeGate);
  const firstFailedPhase = gates.find(
    (gate) => gate.blocking && ['failed', 'cancelled'].includes(gate.status)
  )?.phase;
  const terminalFailure = selectTerminalFailure(input, firstFailedPhase);
  const previousDigest = normalizeDigest(input.previousImage);
  const targetDigest = normalizeDigest(input.targetImage);
  const previousConfigRevision = normalizeConfigRevision(input.previousConfigRevision);
  const configRevision = normalizeConfigRevision(input.configRevision);
  const mode = normalizePromoteMode(input.promoteMode);
  const recoveryReasonProvided = normalizeReasonProvided(input.recoveryReasonProvided);
  if (input.recoveryContract && (mode !== 'recovery' || !recoveryReasonProvided)) {
    throw new Error('Recovery-Evidenz widerspricht dem Promote-Modus.');
  }
  const gatesWithFailure = gates.map((gate) =>
    gate.phase === terminalFailure?.phase &&
    gate.blocking &&
    ['failed', 'cancelled'].includes(gate.status)
      ? { ...gate, failure: terminalFailure }
      : gate
  );
  return {
    schemaVersion: 2,
    run: { id: assertRunId(input.runId), attempt: input.runAttempt },
    environment: input.environment,
    status: input.status,
    mode,
    recoveryReasonProvided,
    git: {
      baseRef: assertGitRef(input.baseRef, 'Base-Ref'),
      headRef: assertGitRef(input.headRef, 'Head-Ref'),
      baseSha: input.baseSha?.trim() ? assertSha(input.baseSha, 'Base-SHA') : null,
      headSha: input.headSha?.trim() ? assertSha(input.headSha, 'Head-SHA') : null,
    },
    image: {
      previousDigest,
      targetDigest,
      revision: input.imageRevision?.trim() ? assertImageRevision(input.imageRevision) : null,
    },
    config: {
      previousRevision: previousConfigRevision,
      revision: configRevision,
      externalSecretReferences: normalizeSecretReferences(input.externalSecretReferences),
    },
    backupAgent: normalizeBackupAgent(input.backupAgent),
    mainE2E: normalizeMainE2EReference(
      input.mainE2EReference,
      input.headSha,
      gates.some((gate) => gate.gate === 'main-e2e-evidence' && gate.status === 'passed')
    ),
    rollback:
      previousDigest && previousConfigRevision
        ? { imageDigest: previousDigest, configRevision: previousConfigRevision }
        : null,
    recovery: projectRecoveryEvidence(input.recoveryContract, {
      previousDigest,
      targetDigest,
      previousConfigRevision,
    }),
    seedPreparation: normalizeEvidenceSeedPreparation(input.seedPreparation, gates, {
      sourceSha: input.headSha?.trim() || null,
      imageDigest: targetDigest,
      configRevision,
    }),
    seedAuthorization: normalizeEvidenceSeedAuthorization(input.seedAuthorization, gates, {
      sourceSha: input.headSha?.trim() || null,
      imageDigest: targetDigest,
      configRevision,
    }),
    gates: gatesWithFailure,
    terminalFailure,
  };
};
