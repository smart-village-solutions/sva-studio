import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  StudioJobStartRequest,
} from '@sva/core';
import type {
  WasteManagementSettingsInterfaceOption,
  WasteCustomRecurrencePresetRecord,
  WasteHolidayStateCode,
  WasteManagementAuditQuery,
  WasteManagementCsvDelimiter,
  WasteManagementHistoryOverview,
  WasteManagementImportSourceFormat,
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteHolidaySyncStatus,
  WasteManagementToursOverview,
  WasteLocationTourPickupDateImportPreview,
  WastePdfStaticSettingsRecord,
  WasteTenantProvisioningRecord,
} from '@sva/waste-management-contracts';
import type { WasteCityHandlerDeps } from './city-deps.js';
import type { WasteTourStatusBulkHandlerDeps } from './tour-status-bulk-deps.js';

type IdempotencyScope = Readonly<{
  instanceId: string;
  actorAccountId: string;
  endpoint: string;
  idempotencyKey: string;
}>;

type IdempotencyReserveResult =
  | { status: 'reserved'; leaseToken?: string }
  | { status: 'replay'; responseStatus: number; responseBody: unknown }
  | { status: 'conflict'; reason: 'payload_mismatch' | 'in_progress'; message: string };

export type AuthenticatedRequestContext = Readonly<{
  sessionId: string;
  activeOrganizationId?: string;
  user: Readonly<{
    id: string;
    instanceId?: string;
    roles: string[];
    email?: string;
    displayName?: string;
  }>;
}>;

export type WasteAuditEvent = Readonly<{
  eventType: 'plugin_action_authorized' | 'plugin_action_denied' | 'plugin_action_failed';
  scope: Readonly<{ kind: 'instance'; instanceId: string }>;
  workspaceId: string;
  outcome: 'success' | 'failure' | 'denied';
  requestId?: string;
  traceId?: string;
  pluginAction: Readonly<{
    actionId: string;
    actionNamespace: string;
    actionOwner: string;
    result: 'success' | 'failure' | 'denied';
    reasonCode?: string;
    resourceType?: string;
    resourceId?: string;
    batchSummary?: Readonly<{
      sourceYear: number;
      targetYear: number;
      transferableCount?: number;
      alreadyEffectiveCount?: number;
      blockedCount?: number;
      createdCount?: number;
      existingCount?: number;
      resourceIds: readonly string[];
    }>;
  }>;
}>;
type ResolveWasteActorInfoResult =
  | {
      readonly actor: {
        readonly instanceId: string;
        readonly requestId?: string;
        readonly traceId?: string;
        readonly actorAccountId?: string;
      };
    }
  | {
      readonly error: Response;
    };

export type WasteManagementHandlerHostDeps = WasteCityHandlerDeps &
  WasteTourStatusBulkHandlerDeps & {
    readonly getRequestId?: () => string | undefined;
    readonly loadDefaultInterfaceRecord?: (
      instanceId: string,
      typeKey: string
    ) => Promise<ExternalInterfaceRecord | null>;
    readonly listInterfaceRecords?: (
      instanceId: string
    ) => Promise<readonly ExternalInterfaceRecord[]>;
    readonly loadWasteTenantProvisioning?: (
      instanceId: string
    ) => Promise<WasteTenantProvisioningRecord | null>;
    readonly requestWasteTenantProvisioning?: (
      instanceId: string
    ) => Promise<WasteTenantProvisioningRecord>;
    readonly failWasteTenantProvisioningRequest?: (input: {
      readonly instanceId: string;
      readonly desiredGeneration: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    }) => Promise<WasteTenantProvisioningRecord | null>;
    readonly saveExternalInterfaceRecord?: (record: ExternalInterfaceRecord) => Promise<void>;
    readonly saveExternalInterfaceConnectionCheck?: (
      record: ExternalInterfaceConnectionCheckRecord
    ) => Promise<void>;
    readonly checkWasteConnection?: (
      instanceId: string,
      interfaceId: string
    ) => Promise<Omit<ExternalInterfaceConnectionCheckRecord, 'interfaceId'>>;
    readonly authorizeAction?: (input: {
      readonly instanceId: string;
      readonly keycloakSubject: string;
      readonly action: string;
      readonly requestId?: string;
    }) => Promise<Response | null>;
    readonly resolveActorInfo?: (
      request: Request,
      ctx: AuthenticatedRequestContext
    ) => Promise<ResolveWasteActorInfoResult>;
    readonly startPluginOperationJob?: (input: {
      readonly instanceId: string;
      readonly actorAccountId: string;
      readonly endpoint: string;
      readonly idempotencyKey: string;
      readonly requestId?: string;
      readonly scheduledAt: string;
      readonly data: StudioJobStartRequest;
      readonly rejectWhenActiveJobExists?: boolean;
    }) => Promise<Response>;
    readonly storeWasteImportSource?: (
      input: Readonly<{ instanceId: string; body: Uint8Array; contentType: string }>
    ) => Promise<string>;
    readonly emitAuditEvent?: (event: WasteAuditEvent) => Promise<void>;
    readonly validateCsrf?: (request: Request, requestId?: string) => Response | null;
    readonly reserveIdempotency?: (
      input: IdempotencyScope & {
        payloadHash: string;
        inProgressLeaseMs: number;
      }
    ) => Promise<IdempotencyReserveResult>;
    readonly renewIdempotencyLease?: (
      input: IdempotencyScope & { leaseToken: string }
    ) => Promise<boolean>;
    readonly releaseIdempotencyReservation?: (
      input: IdempotencyScope & { leaseToken: string }
    ) => Promise<boolean>;
    readonly hasIdempotentAuditEvent?: (
      input: Omit<IdempotencyScope, 'endpoint'> & {
        eventType: string;
        actionId: string;
      }
    ) => Promise<boolean>;
    readonly completeIdempotency?: (
      input: IdempotencyScope & {
        status: 'COMPLETED' | 'FAILED';
        responseStatus: number;
        responseBody: unknown;
        leaseToken: string;
      }
    ) => Promise<boolean>;
    readonly loadWasteHistoryOverview?: (
      query: WasteManagementAuditQuery
    ) => Promise<WasteManagementHistoryOverview>;
    readonly loadMasterDataOverview?: (
      instanceId: string
    ) => Promise<WasteManagementMasterDataOverview>;
    readonly loadMasterDataFractionsOverview?: (
      instanceId: string
    ) => Promise<WasteManagementMasterDataOverview>;
    readonly loadMasterDataLocationsOverview?: (
      instanceId: string
    ) => Promise<WasteManagementMasterDataOverview>;
    readonly loadMasterDataTargetingOverview?: (
      instanceId: string
    ) => Promise<WasteManagementMasterDataOverview>;
    readonly loadToursOverview?: (instanceId: string) => Promise<WasteManagementToursOverview>;
    readonly loadSchedulingOverview?: (
      instanceId: string
    ) => Promise<WasteManagementSchedulingOverview>;
    readonly syncWasteHolidayRules?: (
      instanceId: string,
      stateCode: WasteHolidayStateCode
    ) => Promise<WasteHolidaySyncStatus>;
    readonly loadWasteCustomRecurrencePresets?: (
      instanceId: string
    ) => Promise<readonly WasteCustomRecurrencePresetRecord[]>;
    readonly loadWastePdfStaticSettings?: (
      instanceId: string
    ) => Promise<WastePdfStaticSettingsRecord | null>;
    readonly mapWasteSettingsInterfaceOptions?: (
      records: readonly ExternalInterfaceRecord[],
      selectedInterfaceId?: string
    ) => readonly WasteManagementSettingsInterfaceOption[];
    readonly previewWasteLocationTourPickupDateImport?: (input: {
      readonly instanceId: string;
      readonly sourceFormat: Exclude<
        WasteManagementImportSourceFormat,
        'application/json' | 'application/zip'
      >;
      readonly blobRef: string;
      readonly delimiterOverride?: WasteManagementCsvDelimiter;
    }) => Promise<WasteLocationTourPickupDateImportPreview>;
  };
