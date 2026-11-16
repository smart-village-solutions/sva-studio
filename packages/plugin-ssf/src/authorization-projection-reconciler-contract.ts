import type { SsfAuthorizationProjection } from './authorization-projection.js';
import type { SsfAuthorizationProjectionState } from './authorization-projection-repository.js';

export interface SsfAuthorizationProjectionLockedStore {
  stage(projection: SsfAuthorizationProjection): Promise<SsfAuthorizationProjectionState>;
  claim(input: {
    instanceId: string;
    generation: number;
    desiredRevision: string;
  }): Promise<boolean>;
  confirmReadBack(input: {
    desired: SsfAuthorizationProjection;
    readBack: SsfAuthorizationProjection;
    generation: number;
  }): Promise<boolean>;
  markReady(input: {
    instanceId: string;
    generation: number;
    authorizationRevision: string;
  }): Promise<boolean>;
  markBlocked(input: {
    instanceId: string;
    generation: number;
    desiredRevision: string;
    errorCode: string;
  }): Promise<boolean>;
}
export interface SsfAuthorizationProjectionStore {
  withTenantLock<T>(
    instanceId: string,
    operation: (store: SsfAuthorizationProjectionLockedStore) => Promise<T>
  ): Promise<T>;
}
export type SsfAuthorizationProjectionInput =
  | SsfAuthorizationProjection
  | Readonly<{
      instanceId: string;
      readDesired: () => Promise<SsfAuthorizationProjection>;
    }>;
export interface SsfAuthorizationProjectionTarget {
  /** Resolve a complete target snapshot before staging the effective subject set. */
  resolveProjection(projection: SsfAuthorizationProjection): Promise<SsfAuthorizationProjection>;
  prepareLoginClients(instanceId: string): Promise<void>;
  prepareRuntimeBaseline(instanceId: string): Promise<void>;
  isReady(instanceId: string, authorizationRevision: string): Promise<boolean>;
  suspendTokenIssuance(instanceId: string): Promise<void>;
  reconcile(projection: SsfAuthorizationProjection, authorizationRevision: string): Promise<void>;
  readBack(instanceId: string): Promise<SsfAuthorizationProjection>;
  revokeTenantSessions(instanceId: string, authorizationRevision: string): Promise<void>;
  resumeTokenIssuance(instanceId: string): Promise<void>;
}

/** A concurrent account deletion requires a fresh effective projection, not a tenant failure. */
export class SsfProjectionSubjectsChangedError extends Error {
  constructor() {
    super('ssf_keycloak_projection_subject_missing');
    this.name = 'SsfProjectionSubjectsChangedError';
  }
}
type SsfProjectionFailureReason =
  | 'login_client_preparation_failed'
  | 'runtime_baseline_preparation_failed'
  | 'tenant_instance_id_invalid'
  | 'tenant_readiness_failed'
  | 'token_issuance_suspend_failed'
  | 'target_integrity_failed'
  | 'target_write_failed'
  | 'target_readback_failed'
  | 'target_readback_mismatch'
  | 'token_issuance_resume_failed';
export type SsfAuthorizationProjectionReconcileResult =
  | Readonly<{
      status: 'ready';
      authorizationRevision: string;
      generation: number;
      changed: boolean;
    }>
  | Readonly<{
      status: 'busy' | 'stale';
      generation: number;
    }>
  | Readonly<{
      status: 'blocked';
      generation: number;
      reason: SsfProjectionFailureReason;
    }>;
export class SsfProjectionPhaseError extends Error {
  constructor(readonly reason: SsfProjectionFailureReason) {
    super(reason);
    this.name = 'SsfProjectionPhaseError';
  }
}
