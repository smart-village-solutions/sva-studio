export {
  evaluateAuthorizeDecision,
} from './authorization-engine.js';

export {
  allowReasonCodes,
  denyReasonCodes,
  iamApiErrorCodes,
  iamRolePermissionAssignmentScopes,
} from './authorization-contract.js';

export type {
  AllowReasonCode,
  AuthorizeRequest,
  AuthorizeReasonCode,
  AuthorizeResponse,
  DenyReasonCode,
  EffectivePermission,
  HealthReadyResponse,
  IamApiErrorCode,
  IamApiErrorResponse,
  IamAction,
  IamGeoHierarchyEntry,
  IamGeoNode,
  IamGeoNodeType,
  IamGroupDetail,
  IamGroupListItem,
  IamGroupMembership,
  IamGroupType,
  IamInstanceId,
  IamPermissionProvenance,
  IamPermissionSourceKind,
  IamResourceRef,
  IamRolePermissionAssignmentScope,
  IamUuid,
  LegalAcceptanceActionType,
  LegalConsentExportRecord,
  MatchedPermissionSummary,
  MePermissionsRequest,
  MePermissionsResponse,
  MePermissionsSubject,
  ReadinessStatus,
  RuntimeDependencyHealth,
  RuntimeDependencyKey,
  RuntimeDependencyStatus,
  RuntimeHealthResponse,
  RuntimeHealthServices,
  SnapshotCacheStatus,
} from './authorization-contract.js';

export {
  authorizePerformanceScenarios,
  buildAuthorizePerformancePayload,
  renderAuthorizePerformanceMarkdownReport,
  summarizeAuthorizePerformanceDurations,
} from './authorize-performance-contract.js';

export type {
  AuthorizePerformanceDurationSummary,
  AuthorizePerformanceEvaluation,
  AuthorizePerformancePayload,
  AuthorizePerformanceReportReference,
  AuthorizePerformanceRequest,
  AuthorizePerformanceRunResponse,
  AuthorizePerformanceRunResult,
  AuthorizePerformanceScenario,
  AuthorizePerformanceScenarioResult,
} from './authorize-performance-contract.js';

export * from './package-metadata.js';
