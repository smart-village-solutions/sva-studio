import type {
  IamInstanceDetail,
  IamTenantIamAxisStatus,
} from '@sva/core';

import type { DetailWorkflowAction } from './-instances-shared-types';

export type RealmOperationsMode = 'new' | 'existing';
export type OperationStepStatus = 'offen' | 'bereit' | 'läuft' | 'erfolgreich' | 'fehlgeschlagen';
export type EvidenceSource =
  | 'registry_contract'
  | 'worker_preflight'
  | 'worker_plan'
  | 'keycloak_run'
  | 'final_validation'
  | 'history';
export type NextActionReason =
  | 'missing_contract'
  | 'mode_conflict'
  | 'preflight_blocked'
  | 'run_retry'
  | 'secret_sync'
  | 'final_validation'
  | 'follow_up';
export type DetailNavigationAction = 'focus_configuration';
export type OperationsDetailAction = DetailWorkflowAction | DetailNavigationAction;
export type OperationsStepKey =
  | 'registry_contract'
  | 'worker_preflight'
  | 'worker_plan'
  | 'realm'
  | 'login_client'
  | 'tenant_admin_client'
  | 'realm_roles'
  | 'tenant_admin'
  | 'secret_sync'
  | 'final_validation'
  | 'realm_bootstrap_complete'
  | 'live_status'
  | 'drift_analysis'
  | 'contract_repair'
  | 'reconcile'
  | 'result_validation';

export type OperationsStepModel = {
  readonly key: OperationsStepKey;
  readonly title: string;
  readonly status: OperationStepStatus;
  readonly summary: string;
  readonly evidenceSource: EvidenceSource;
  readonly checkedAt?: string;
  readonly requestId?: string;
  readonly action?: OperationsDetailAction;
};

export type OperationsPrimaryAction = {
  readonly action: OperationsDetailAction;
  readonly label: string;
  readonly reason: NextActionReason;
};

export type RealmOperationsModel = {
  readonly mode: RealmOperationsMode;
  readonly status: IamTenantIamAxisStatus;
  readonly summary: string;
  readonly steps: readonly OperationsStepModel[];
  readonly followUpActions: readonly OperationsDetailAction[];
  readonly signals: {
    readonly modeConflict: boolean;
    readonly hasDrift: boolean;
  };
};

export type HistoryWorkspaceModel = {
  readonly currentRun?: NonNullable<IamInstanceDetail['latestKeycloakProvisioningRun']>;
  readonly historicalRuns: readonly NonNullable<IamInstanceDetail['keycloakProvisioningRuns']>[number][];
  readonly hasHistoricalMismatchHint: boolean;
};
