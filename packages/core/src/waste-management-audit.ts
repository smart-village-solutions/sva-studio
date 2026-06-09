export type WasteManagementAuditOutcome = 'success' | 'failure' | 'denied';

export type WasteManagementAuditRecord = {
  readonly id: string;
  readonly actionId: string;
  readonly actionNamespace: 'waste-management';
  readonly actionOwner: 'waste-management';
  readonly outcome: WasteManagementAuditOutcome;
  readonly occurredAt: string;
  readonly actorAccountId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly reasonCode?: string;
  readonly requestId?: string;
  readonly traceId?: string;
};

export type WasteManagementAuditQuery = {
  readonly instanceId: string;
  readonly search?: string;
  readonly page: number;
  readonly pageSize: number;
};

export type WasteManagementAuditOverview = {
  readonly items: readonly WasteManagementAuditRecord[];
  readonly total: number;
};

export type WasteManagementTechnicalHistoryOutcome = 'started' | 'success' | 'failure';

export type WasteManagementTechnicalHistoryRecord = {
  readonly id: string;
  readonly eventType:
    | 'datasource.reconfigured'
    | 'connection-check.succeeded'
    | 'connection-check.failed'
    | 'migration.started'
    | 'migration.succeeded'
    | 'migration.failed'
    | 'import.started'
    | 'import.succeeded'
    | 'import.failed'
    | 'seed.started'
    | 'seed.succeeded'
    | 'seed.failed'
    | 'reset.started'
    | 'reset.succeeded'
    | 'reset.failed'
    | 'sync.started'
    | 'sync.succeeded'
    | 'sync.failed';
  readonly outcome: WasteManagementTechnicalHistoryOutcome;
  readonly occurredAt: string;
  readonly source: 'audit' | 'job';
  readonly jobId?: string;
  readonly jobTypeId?: string;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly message?: string;
  readonly errorCode?: string;
};

export type WasteManagementTechnicalHistoryOverview = {
  readonly items: readonly WasteManagementTechnicalHistoryRecord[];
  readonly total: number;
};

export type WasteManagementHistoryOverview = {
  readonly audit: WasteManagementAuditOverview;
  readonly technical: WasteManagementTechnicalHistoryOverview;
};
