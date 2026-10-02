import type {
  IamRuntimeDiagnosticClassification,
  IamRuntimeDiagnosticStatus,
  IamRuntimeSafeDetails,
  IamUserGroupAssignment,
} from '@sva/core';

export type SessionUser = {
  id: string;
  instanceId?: string;
  instanceDisplayName?: string;
  assignedModules?: string[];
  moduleAccessPending?: boolean;
  groups?: readonly IamUserGroupAssignment[];
  keycloakRoles?: string[];
  permissionActions?: readonly string[];
  roles: string[];
  permissionStatus?: 'ok' | 'degraded';
};

export type AuthState = {
  readonly user: SessionUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly hasResolvedSession: boolean;
  readonly isRecoveringSession: boolean;
  readonly sessionRecoveryFailed: boolean;
  readonly permissionsDegraded: boolean;
  readonly isDevAuthAvailable: boolean;
};

export type AuthContextValue = AuthState & {
  refetch: () => Promise<void>;
  loginWithDevAuth: () => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

export type AuthMeResponse = {
  readonly expiresAt?: number;
  readonly user?: SessionUser;
};

export type AuthDiagnosticMeta = Readonly<{
  authFlowId: string;
  attempt: number;
  classification?: IamRuntimeDiagnosticClassification;
  diagnosticStatus?: IamRuntimeDiagnosticStatus;
  pathname?: string;
  reasonCode?: string;
  recoveryStep?: string;
  requestId?: string;
  result?: string;
  safeDetails?: IamRuntimeSafeDetails;
  status?: number;
}>;
