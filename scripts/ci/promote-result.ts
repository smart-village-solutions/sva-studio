import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type PromoteEnvironment = 'dev' | 'staging' | 'prod' | 'invalid';

export type PromotePhase =
  | 'input-validation'
  | 'source-contract'
  | 'image-contract'
  | 'main-e2e-evidence'
  | 'config-build'
  | 'static-preflight'
  | 'candidate-preflight'
  | 'staging-parity'
  | 'backup-capabilities'
  | 'backup'
  | 'migration'
  | 'bootstrap'
  | 'postconditions'
  | 'deploy'
  | 'swarm-convergence'
  | 'external-smoke'
  | 'digest-verification'
  | 'evidence';

export type PromoteErrorCode =
  | 'PROMOTE_INPUT_INVALID'
  | 'PROMOTE_SOURCE_CONTRACT_INVALID'
  | 'PROMOTE_PERMISSION_SNAPSHOT_SECRET_INVALID'
  | 'PROMOTE_IMAGE_CONTRACT_INVALID'
  | 'PROMOTE_MAIN_E2E_NOT_READY'
  | 'PROMOTE_MAIN_E2E_REJECTED'
  | 'PROMOTE_MAIN_E2E_LOOKUP_FAILED'
  | 'PROMOTE_DEPLOY_GATES_REJECTED'
  | 'PROMOTE_CONFIG_SOURCE_FORBIDDEN'
  | 'PROMOTE_CONFIG_INVALID'
  | 'PROMOTE_CONFIG_REQUIRED_KEY_MISSING'
  | 'PROMOTE_CONFIG_SHADOW_MISMATCH'
  | 'PROMOTE_RECOVERY_REASON_REQUIRED'
  | 'PROMOTE_MODE_INVALID'
  | 'PROMOTE_PREFLIGHT_CONFIG_INVALID'
  | 'PROMOTE_PREFLIGHT_SECRET_REFERENCE_MISSING'
  | 'PROMOTE_PREFLIGHT_TENANT_SCOPE_MISMATCH'
  | 'PROMOTE_PREFLIGHT_TENANT_SECRET_UNREADABLE'
  | 'PROMOTE_PARITY_DIGEST_MISMATCH'
  | 'PROMOTE_BACKUP_AGENT_INCOMPATIBLE'
  | 'PROMOTE_SWARM_CONVERGENCE_TIMEOUT'
  | 'PROMOTE_SMOKE_REALM_MISMATCH'
  | 'PROMOTE_SMOKE_CALLBACK_MISMATCH'
  | 'PROMOTE_READINESS_NOT_READY'
  | 'PROMOTE_LIVE_DIGEST_MISMATCH'
  | 'PROMOTE_INTERNAL_ERROR';

export type PromoteFailure = Readonly<{
  code: PromoteErrorCode;
  environment: PromoteEnvironment;
  phase: PromotePhase;
  summary: string;
  retryable: boolean;
  nextAction: string;
}>;

type PromoteFailureDefinition = Readonly<
  Pick<PromoteFailure, 'summary' | 'retryable' | 'nextAction'>
>;

const promoteFailureDefinitions: Readonly<Record<PromoteErrorCode, PromoteFailureDefinition>> = {
  PROMOTE_INPUT_INVALID: {
    summary: 'Die Promote-Eingaben verletzen den Workflow-Vertrag.',
    retryable: false,
    nextAction: 'Die Eingaben anhand des Promote-Vertrags korrigieren.',
  },
  PROMOTE_SOURCE_CONTRACT_INVALID: {
    summary: 'Die angeforderte Git-Grenze konnte nicht sicher gebunden werden.',
    retryable: false,
    nextAction: 'Base- und Head-Ref sowie ihre Ancestor-Beziehung prüfen.',
  },
  PROMOTE_PERMISSION_SNAPSHOT_SECRET_INVALID: {
    summary: 'Das geschützte Permission-Snapshot-Secret erfüllt den Vertrag nicht.',
    retryable: false,
    nextAction: 'Das Environment-Secret mit ausreichender Entropie bereitstellen.',
  },
  PROMOTE_IMAGE_CONTRACT_INVALID: {
    summary: 'Image-Referenz und Git-Revision erfüllen den Promote-Vertrag nicht.',
    retryable: false,
    nextAction: 'Image-Digest, Revision und angeforderte Git-Grenze prüfen.',
  },
  PROMOTE_MAIN_E2E_NOT_READY: {
    summary: 'Die kanonische Main-E2E-Evidenz ist noch nicht terminal verfügbar.',
    retryable: true,
    nextAction: 'Den kanonischen Main-E2E-Lauf abschließen lassen und Promote erneut starten.',
  },
  PROMOTE_MAIN_E2E_REJECTED: {
    summary: 'Die Main-E2E-Evidenz erfüllt den Staging-Promote-Vertrag nicht.',
    retryable: false,
    nextAction:
      'Den kanonischen Main-Push-Lauf prüfen, korrigieren und erfolgreich erneut ausführen.',
  },
  PROMOTE_MAIN_E2E_LOOKUP_FAILED: {
    summary: 'Die Main-E2E-Evidenz konnte nicht zuverlässig abgefragt werden.',
    retryable: true,
    nextAction: 'GitHub-Actions-Zugriff und API-Verfügbarkeit prüfen und Promote erneut starten.',
  },
  PROMOTE_DEPLOY_GATES_REJECTED: {
    summary: 'Migration- oder Bootstrap-Policy hat die Promotion abgelehnt.',
    retryable: false,
    nextAction: 'Änderungsumfang und explizite Migration- beziehungsweise Bootstrap-Modi prüfen.',
  },
  PROMOTE_CONFIG_SOURCE_FORBIDDEN: {
    summary: 'Eine unzulässige Remote-Konfigurationsquelle wurde abgelehnt.',
    retryable: false,
    nextAction: 'Das getrackte Remote-Profil und das geschützte Override-Bundle verwenden.',
  },
  PROMOTE_CONFIG_INVALID: {
    summary: 'Die Remote-Konfiguration verletzt den Promote-Vertrag.',
    retryable: false,
    nextAction:
      'Remote-Profil und geschütztes Override-Bundle anhand des Config-Vertrags korrigieren.',
  },
  PROMOTE_CONFIG_REQUIRED_KEY_MISSING: {
    summary: 'Die Remote-Konfiguration ist unvollständig.',
    retryable: false,
    nextAction: 'Die fehlenden Pflichtwerte in ihrer zulässigen Konfigurationsschicht ergänzen.',
  },
  PROMOTE_CONFIG_SHADOW_MISMATCH: {
    summary: 'Der beobachtende Config-Builder ist nicht äquivalent zum autoritativen Pfad.',
    retryable: false,
    nextAction: 'Die redigierte Shadow-Abweichung prüfen und vor einer Aktivierung beheben.',
  },
  PROMOTE_RECOVERY_REASON_REQUIRED: {
    summary: 'Der Recovery-Modus wurde ohne dokumentierten Grund angefordert.',
    retryable: false,
    nextAction: 'Den Recovery-Grund dokumentieren und das geschützte Environment erneut freigeben.',
  },
  PROMOTE_MODE_INVALID: {
    summary: 'Der angeforderte Promote-Modus ist ungültig.',
    retryable: false,
    nextAction: 'Den Promote-Modus auf standard oder recovery setzen.',
  },
  PROMOTE_PREFLIGHT_CONFIG_INVALID: {
    summary: 'Der read-only Candidate hat eine ungültige Runtime-Konfiguration erkannt.',
    retryable: false,
    nextAction: 'Die Candidate-Konfiguration korrigieren und den Preflight erneut ausführen.',
  },
  PROMOTE_PREFLIGHT_SECRET_REFERENCE_MISSING: {
    summary: 'Eine erforderliche externe Secret-Referenz ist nicht verfügbar.',
    retryable: false,
    nextAction: 'Die referenzierte Secret-Ressource im Zielsystem bereitstellen.',
  },
  PROMOTE_PREFLIGHT_TENANT_SCOPE_MISMATCH: {
    summary: 'Der Release-Tenant-Scope des Candidates ist nicht zulässig.',
    retryable: false,
    nextAction: 'Den erwarteten Release-Tenant-Scope wiederherstellen.',
  },
  PROMOTE_PREFLIGHT_TENANT_SECRET_UNREADABLE: {
    summary: 'Der Candidate kann aktive Tenant-Secrets nicht entschlüsseln.',
    retryable: false,
    nextAction: 'Den geschützten IAM-Schlüsselbund gegen den Zielbestand prüfen.',
  },
  PROMOTE_PARITY_DIGEST_MISMATCH: {
    summary: 'Für den Zieldigest fehlt eine passende erfolgreiche Staging-Evidenz.',
    retryable: false,
    nextAction: 'Exakt denselben Digest zuerst erfolgreich nach Staging promoten.',
  },
  PROMOTE_BACKUP_AGENT_INCOMPATIBLE: {
    summary: 'Der laufende Backup-Agent erfüllt den erforderlichen Consumer-Vertrag nicht.',
    retryable: false,
    nextAction: 'Zuerst einen kompatiblen Backup-Agenten ausrollen und live nachweisen.',
  },
  PROMOTE_SWARM_CONVERGENCE_TIMEOUT: {
    summary: 'Der Swarm-Service hat den erwarteten terminalen Zustand nicht erreicht.',
    retryable: true,
    nextAction:
      'Service- und Task-Zustände prüfen und nur nach Infrastrukturklassifikation erneut ausführen.',
  },
  PROMOTE_SMOKE_REALM_MISMATCH: {
    summary: 'Der Live-IAM-Realm entspricht nicht dem erwarteten Vertrag.',
    retryable: false,
    nextAction: 'Realm- und Runtime-Konfiguration korrigieren.',
  },
  PROMOTE_SMOKE_CALLBACK_MISMATCH: {
    summary: 'Die Live-Callback-Konfiguration entspricht nicht dem erwarteten Vertrag.',
    retryable: false,
    nextAction: 'Callback-Host und IAM-Client-Konfiguration korrigieren.',
  },
  PROMOTE_READINESS_NOT_READY: {
    summary: 'Die Zielumgebung erfüllt den Readiness-Vertrag nicht.',
    retryable: true,
    nextAction: 'Konvergenz und Readiness prüfen und nur im zulässigen Modus fortfahren.',
  },
  PROMOTE_LIVE_DIGEST_MISMATCH: {
    summary: 'Der live laufende Image-Digest entspricht nicht dem Zieldigest.',
    retryable: false,
    nextAction: 'Den Swarm-Zustand und die Digest-Bindung prüfen.',
  },
  PROMOTE_INTERNAL_ERROR: {
    summary: 'Ein unerwarteter interner Fehler hat das Promote-Gate beendet.',
    retryable: false,
    nextAction:
      'Runner-Logs mit eingeschränktem Zugriff prüfen und den Fehler einem stabilen Code zuordnen.',
  },
};

const promoteEnvironments: readonly PromoteEnvironment[] = ['dev', 'staging', 'prod', 'invalid'];
const promotePhases: readonly PromotePhase[] = [
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
];

const isPromoteEnvironment = (value: unknown): value is PromoteEnvironment =>
  typeof value === 'string' && promoteEnvironments.includes(value as PromoteEnvironment);

export const normalizePromoteEnvironment = (value: unknown): PromoteEnvironment =>
  isPromoteEnvironment(value) && value !== 'invalid' ? value : 'invalid';

const isPromotePhase = (value: unknown): value is PromotePhase =>
  typeof value === 'string' && promotePhases.includes(value as PromotePhase);

const isPromoteErrorCode = (value: unknown): value is PromoteErrorCode =>
  typeof value === 'string' && Object.hasOwn(promoteFailureDefinitions, value);

export const buildPromoteFailure = (input: {
  code: PromoteErrorCode;
  environment: PromoteEnvironment;
  phase: PromotePhase;
}): PromoteFailure => ({
  code: input.code,
  environment: input.environment,
  phase: input.phase,
  ...promoteFailureDefinitions[input.code],
});

export class PromoteContractError extends Error {
  readonly failure: PromoteFailure;

  constructor(failure: PromoteFailure) {
    super(`${failure.code}: ${failure.summary}`);
    this.name = 'PromoteContractError';
    this.failure = failure;
  }
}

export const redactPromoteFailure = (
  error: unknown,
  context: Pick<PromoteFailure, 'environment' | 'phase'>
): PromoteFailure =>
  buildPromoteFailure({
    code:
      error instanceof PromoteContractError && isPromoteErrorCode(error.failure.code)
        ? error.failure.code
        : 'PROMOTE_INTERNAL_ERROR',
    environment: context.environment,
    phase: context.phase,
  });

export const parsePromoteFailure = (value: unknown): PromoteFailure | null => {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PromoteFailure>;
  if (
    !isPromoteErrorCode(candidate.code) ||
    !isPromoteEnvironment(candidate.environment) ||
    !isPromotePhase(candidate.phase)
  )
    return null;
  return buildPromoteFailure({
    code: candidate.code,
    environment: candidate.environment,
    phase: candidate.phase,
  });
};

export const writePromoteFailureRecord = (
  failure: PromoteFailure,
  outputPath = process.env.PROMOTE_FAILURE_PATH
): string | null => {
  if (!outputPath) return null;
  const redacted = parsePromoteFailure(failure);
  if (!redacted) throw new Error('Ungültiger Promote-Fehlervertrag.');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(redacted, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return outputPath;
};
