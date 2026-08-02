export type PromotePhase =
  | 'config-build'
  | 'static-preflight'
  | 'candidate-preflight'
  | 'staging-parity'
  | 'backup-capabilities'
  | 'backup'
  | 'migration'
  | 'bootstrap'
  | 'deploy'
  | 'swarm-convergence'
  | 'external-smoke'
  | 'digest-verification'
  | 'evidence';

export type PromoteErrorCode =
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
  environment: 'dev' | 'staging' | 'prod';
  phase: PromotePhase;
  summary: string;
  retryable: boolean;
  nextAction: string;
}>;

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
  context: Pick<PromoteFailure, 'environment' | 'phase'>,
): PromoteFailure => error instanceof PromoteContractError
  ? error.failure
  : {
      ...context,
      code: 'PROMOTE_INTERNAL_ERROR',
      summary: 'Ein unerwarteter interner Fehler hat das Promote-Gate beendet.',
      retryable: false,
      nextAction: 'Runner-Logs mit eingeschraenktem Zugriff pruefen und den Fehler einem stabilen Code zuordnen.',
    };
