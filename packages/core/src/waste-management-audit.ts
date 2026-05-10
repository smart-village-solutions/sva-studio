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
