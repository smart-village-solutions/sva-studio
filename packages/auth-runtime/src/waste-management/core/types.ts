import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  WasteManagementSettingsInterfaceOption,
  StudioJobStartRequest,
  WasteCityRecord,
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
  WasteManagementAuditOverview,
  WasteManagementAuditQuery,
  WasteManagementCsvDelimiter,
  WasteManagementHistoryOverview,
  WasteManagementImportSourceFormat,
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteHolidaySyncStatus,
  WasteManagementToursOverview,
  WasteLocationTourPickupDateImportPreview,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/core';
import type { EffectivePermission } from '@sva/iam-core';
import type { ResolvedWasteDataSource } from '@sva/server-runtime';

import type { emitAuthAuditEvent } from '../../audit-events.js';
import type { AuthenticatedRequestContext } from '../../middleware.js';
import type { Session } from '../../types.js';

export type WasteCustomRecurrencePresetFallback = {
  readonly kind: 'preset' | 'default';
  readonly value: string;
};

export type SaveWasteCustomRecurrencePresetsInput = {
  readonly nextItems: readonly Omit<WasteCustomRecurrencePresetRecord, 'createdAt' | 'updatedAt'>[];
  readonly deletedPresetFallbacks: Readonly<Record<string, WasteCustomRecurrencePresetFallback>>;
};

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

export type WasteManagementHandlerDeps = {
  readonly getRequestId?: () => string | undefined;
  readonly getSessionById?: (sessionId: string) => Promise<Session | undefined>;
  readonly loadDefaultInterfaceRecord?: (
    instanceId: string,
    typeKey: string
  ) => Promise<ExternalInterfaceRecord | null>;
  readonly listInterfaceRecords?: (instanceId: string) => Promise<readonly ExternalInterfaceRecord[]>;
  readonly saveExternalInterfaceRecord?: (record: ExternalInterfaceRecord) => Promise<void>;
  readonly saveExternalInterfaceConnectionCheck?: (record: ExternalInterfaceConnectionCheckRecord) => Promise<void>;
  readonly protectSecret?: (value: string, aad: string) => string | null | undefined;
  readonly revealSecret?: (ciphertext: string | null | undefined, aad: string) => string | null | undefined;
  readonly runConnectionProbe?: (dataSource: ResolvedWasteDataSource) => Promise<void>;
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
  }) => Promise<Response>;
  readonly emitAuditEvent?: typeof emitAuthAuditEvent;
  readonly loadWasteAuditOverview?: (query: WasteManagementAuditQuery) => Promise<WasteManagementAuditOverview>;
  readonly loadWasteHistoryOverview?: (query: WasteManagementAuditQuery) => Promise<WasteManagementHistoryOverview>;
  readonly loadMasterDataOverview?: (instanceId: string) => Promise<WasteManagementMasterDataOverview>;
  readonly loadMasterDataFractionsOverview?: (instanceId: string) => Promise<WasteManagementMasterDataOverview>;
  readonly loadMasterDataLocationsOverview?: (instanceId: string) => Promise<WasteManagementMasterDataOverview>;
  readonly loadToursOverview?: (instanceId: string) => Promise<WasteManagementToursOverview>;
  readonly loadSchedulingOverview?: (instanceId: string) => Promise<WasteManagementSchedulingOverview>;
  readonly syncWasteHolidayRules?: (
    instanceId: string,
    stateCode: WasteHolidayStateCode
  ) => Promise<WasteHolidaySyncStatus>;
  readonly loadWasteCustomRecurrencePresets?: (
    instanceId: string
  ) => Promise<readonly WasteCustomRecurrencePresetRecord[]>;
  readonly mapWasteSettingsInterfaceOptions?: (
    records: readonly ExternalInterfaceRecord[],
    selectedInterfaceId?: string
  ) => readonly WasteManagementSettingsInterfaceOption[];
  readonly previewWasteLocationTourPickupDateImport?: (input: {
    readonly instanceId: string;
    readonly sourceFormat: WasteManagementImportSourceFormat;
    readonly blobRef: string;
    readonly delimiterOverride?: WasteManagementCsvDelimiter;
  }) => Promise<WasteLocationTourPickupDateImportPreview>;
  readonly saveWasteFraction?: (instanceId: string, input: Omit<WasteFractionRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteFractionById?: (instanceId: string, fractionId: string) => Promise<WasteFractionRecord | null>;
  readonly deleteWasteFraction?: (instanceId: string, fractionId: string) => Promise<void>;
  readonly saveWasteRegion?: (instanceId: string, input: Omit<WasteRegionRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteRegionById?: (instanceId: string, regionId: string) => Promise<WasteRegionRecord | null>;
  readonly saveWasteCity?: (instanceId: string, input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteCityById?: (instanceId: string, cityId: string) => Promise<WasteCityRecord | null>;
  readonly saveWasteStreet?: (instanceId: string, input: Omit<WasteStreetRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteStreetById?: (instanceId: string, streetId: string) => Promise<WasteStreetRecord | null>;
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
  readonly deleteWasteCollectionLocation?: (instanceId: string, locationId: string) => Promise<void>;
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
  readonly deleteWasteLocationTourPickupDate?: (instanceId: string, pickupDateId: string) => Promise<void>;
  readonly saveWasteTour?: (instanceId: string, input: Omit<WasteTourRecord, 'createdAt' | 'updatedAt'>) => Promise<void>;
  readonly loadWasteTourById?: (instanceId: string, tourId: string) => Promise<WasteTourRecord | null>;
  readonly deleteWasteTour?: (instanceId: string, tourId: string) => Promise<void>;
  readonly saveWasteCustomRecurrencePresets?: (
    instanceId: string,
    input: SaveWasteCustomRecurrencePresetsInput
  ) => Promise<void>;
  readonly saveWasteTourDateShift?: (
    instanceId: string,
    input: Omit<WasteTourDateShiftRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
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
