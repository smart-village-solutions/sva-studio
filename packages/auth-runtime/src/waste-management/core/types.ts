import type { ExternalInterfaceConnectionCheckRecord, ExternalInterfaceRecord, StudioJobStartRequest } from '@sva/core';
import type {
  WasteManagementSettingsInterfaceOption,
  WasteCollectionLocationRecord,
  WasteCustomRecurrencePresetRecord,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHolidayRuleRecord,
  WasteHolidayStateCode,
  WasteHouseNumberRecord,
  WasteLocationTourLinkBulkCreateInput,
  WasteLocationTourPickupDateListFilter,
  WasteLocationTourPickupDateRecord,
  WasteLocationTourLinkRecord,
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
  WastePdfStaticSettingsWriteInput,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
  WasteTourValidityBulkUpdateInput,
  WasteTourValidityBulkUpdateResult,
  WasteTenantProvisioningRecord,
} from '@sva/waste-management-contracts';
import type { EffectivePermission } from '@sva/iam-core';

import type { emitAuthAuditEvent } from '../../audit-events.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import type { WasteAnnualTourTransferHandlerDeps } from './annual-tour-transfer-deps.js';
import type { WasteCityHandlerDeps } from './city-deps.js';
import type { WasteCollectionLocationReadHandlerDeps } from './collection-location-read-deps.js';
import type { SaveWasteCustomRecurrencePresetsInput } from './custom-recurrence-deps.js';
import type { WasteMainserverSyncStatusHandlerDeps } from './mainserver-sync-status-deps.js';
import type { WasteTourDateShiftWriter } from './tour-date-shift-deps.js';
import type { WasteTourStatusBulkHandlerDeps } from './tour-status-bulk-deps.js';

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

type WasteManagementHandlerDepsBase = WasteCityHandlerDeps & WasteTourStatusBulkHandlerDeps & {
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
    interfaceRecord: ExternalInterfaceRecord
  ) => Promise<Omit<ExternalInterfaceConnectionCheckRecord, 'interfaceId'>>;
  readonly resolvePermissions?: (input: {
    readonly instanceId: string;
    readonly keycloakSubject: string;
    readonly organizationId?: string;
  }) => Promise<
    | {
        readonly ok: true;
        readonly permissions: readonly EffectivePermission[];
      }
    | {
        readonly ok: false;
        readonly error: string;
      }
  >;
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
  readonly emitAuditEvent?: typeof emitAuthAuditEvent;
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
  readonly saveWasteFraction?: (
    instanceId: string,
    input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteFractionById?: (
    instanceId: string,
    fractionId: string
  ) => Promise<WasteFractionRecord | null>;
  readonly deleteWasteFraction?: (instanceId: string, fractionId: string) => Promise<void>;
  readonly saveWasteRegion?: (
    instanceId: string,
    input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteRegionById?: (
    instanceId: string,
    regionId: string
  ) => Promise<WasteRegionRecord | null>;
  readonly saveWasteStreet?: (
    instanceId: string,
    input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteStreetById?: (
    instanceId: string,
    streetId: string
  ) => Promise<WasteStreetRecord | null>;
  readonly saveWasteHouseNumber?: (
    instanceId: string,
    input: Omit<WasteHouseNumberRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteHouseNumberById?: (
    instanceId: string,
    houseNumberId: string
  ) => Promise<WasteHouseNumberRecord | null>;
  readonly saveWasteCollectionLocation?: (
    instanceId: string,
    input: Omit<WasteCollectionLocationRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteCollectionLocationById?: (
    instanceId: string,
    locationId: string
  ) => Promise<WasteCollectionLocationRecord | null>;
  readonly deleteWasteCollectionLocation?: (
    instanceId: string,
    locationId: string
  ) => Promise<void>;
  readonly saveWasteLocationTourLink?: (
    instanceId: string,
    input: Omit<WasteLocationTourLinkRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly saveWasteLocationTourLinksBulk?: (
    instanceId: string,
    input: WasteLocationTourLinkBulkCreateInput
  ) => Promise<readonly WasteLocationTourLinkRecord[]>;
  readonly loadWasteLocationTourLinkById?: (
    instanceId: string,
    linkId: string
  ) => Promise<WasteLocationTourLinkRecord | null>;
  readonly listWasteLocationTourLinksByTourId?: (
    instanceId: string,
    tourId: string
  ) => Promise<readonly WasteLocationTourLinkRecord[]>;
  readonly deleteWasteLocationTourLink?: (instanceId: string, linkId: string) => Promise<void>;
  readonly saveWasteLocationTourPickupDate?: (
    instanceId: string,
    input: Omit<WasteLocationTourPickupDateRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteLocationTourPickupDateById?: (
    instanceId: string,
    pickupDateId: string
  ) => Promise<WasteLocationTourPickupDateRecord | null>;
  readonly listWasteLocationTourPickupDates?: (
    instanceId: string,
    filter?: WasteLocationTourPickupDateListFilter
  ) => Promise<readonly WasteLocationTourPickupDateRecord[]>;
  readonly deleteWasteLocationTourPickupDate?: (
    instanceId: string,
    pickupDateId: string
  ) => Promise<void>;
  readonly saveWasteTourAssignment?: (
    instanceId: string,
    input: Omit<import('@sva/waste-management-contracts').WasteTourAssignmentRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly loadWasteTourAssignmentById?: (
    instanceId: string,
    assignmentId: string
  ) => Promise<import('@sva/waste-management-contracts').WasteTourAssignmentRecord | null>;
  readonly listWasteTourAssignments?: (
    instanceId: string,
    filter?: import('@sva/waste-management-contracts').WasteTourAssignmentListFilter
  ) => Promise<readonly import('@sva/waste-management-contracts').WasteTourAssignmentRecord[]>;
  readonly deleteWasteTourAssignment?: (instanceId: string, assignmentId: string) => Promise<void>;
  readonly saveWasteTour?: (
    instanceId: string,
    input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly updateWasteTourValidityBulk?: (
    instanceId: string,
    input: WasteTourValidityBulkUpdateInput
  ) => Promise<WasteTourValidityBulkUpdateResult>;
  readonly loadWasteTourById?: (
    instanceId: string,
    tourId: string
  ) => Promise<WasteTourRecord | null>;
  readonly deleteWasteTour?: (instanceId: string, tourId: string) => Promise<void>;
  readonly saveWasteCustomRecurrencePresets?: (
    instanceId: string,
    input: SaveWasteCustomRecurrencePresetsInput
  ) => Promise<void>;
  readonly saveWastePdfStaticSettings?: (
    instanceId: string,
    input: WastePdfStaticSettingsWriteInput
  ) => Promise<void>;
  readonly saveWasteTourDateShift?: WasteTourDateShiftWriter;
  readonly createWasteTourDateShift?: WasteTourDateShiftWriter;
  readonly loadWasteTourDateShiftById?: (
    instanceId: string,
    shiftId: string
  ) => Promise<WasteTourDateShiftRecord | null>;
  readonly listWasteTourDateShiftsByTourId?: (
    instanceId: string,
    tourId: string
  ) => Promise<readonly WasteTourDateShiftRecord[]>;
  readonly deleteWasteTourDateShift?: (instanceId: string, shiftId: string) => Promise<void>;
  readonly saveWasteGlobalDateShift?: (
    instanceId: string,
    input: Omit<WasteGlobalDateShiftRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly saveWasteHolidayRule?: (
    instanceId: string,
    input: Omit<WasteHolidayRuleRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  readonly deleteWasteHolidayRule?: (instanceId: string, ruleId: string) => Promise<void>;
  readonly loadWasteGlobalDateShiftById?: (
    instanceId: string,
    shiftId: string
  ) => Promise<WasteGlobalDateShiftRecord | null>;
  readonly loadWasteHolidayRuleById?: (
    instanceId: string,
    ruleId: string
  ) => Promise<WasteHolidayRuleRecord | null>;
  readonly deleteWasteGlobalDateShift?: (instanceId: string, shiftId: string) => Promise<void>;
};

export type WasteManagementHandlerDeps = WasteManagementHandlerDepsBase &
  WasteAnnualTourTransferHandlerDeps &
  WasteCollectionLocationReadHandlerDeps &
  WasteMainserverSyncStatusHandlerDeps;
