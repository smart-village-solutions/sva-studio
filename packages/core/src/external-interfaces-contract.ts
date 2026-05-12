const externalInterfaceTypeKeys = ['sva_mainserver', 's3', 'supabase'] as const;
const externalInterfaceOwnerKinds = ['host', 'plugin'] as const;
const externalInterfaceCategories = ['api', 'object_storage', 'database', 'feed'] as const;
const externalInterfaceStatusCheckKinds = ['none', 'sva_mainserver', 's3', 'supabase'] as const;
const externalInterfaceVisibleStatuses = ['not_configured', 'unknown', 'ok', 'error', 'disabled'] as const;
const externalInterfaceCheckStatuses = ['succeeded', 'failed'] as const;
const externalInterfaceRuntimeErrorCodes = [
  'not_configured',
  'default_missing',
  'disabled',
  'secret_missing',
  'secret_unreadable',
  'connection_failed',
] as const;

export type ExternalInterfaceTypeKey = (typeof externalInterfaceTypeKeys)[number];
export type ExternalInterfaceOwnerKind = (typeof externalInterfaceOwnerKinds)[number];
export type ExternalInterfaceCategory = (typeof externalInterfaceCategories)[number];
export type ExternalInterfaceStatusCheckKind = (typeof externalInterfaceStatusCheckKinds)[number];
export type ExternalInterfaceVisibleStatus = (typeof externalInterfaceVisibleStatuses)[number];
type ExternalInterfaceCheckStatus = (typeof externalInterfaceCheckStatuses)[number];
export type ExternalInterfaceRuntimeErrorCode = (typeof externalInterfaceRuntimeErrorCodes)[number];

export type ExternalInterfaceTypeDefinition = Readonly<{
  typeKey: ExternalInterfaceTypeKey | string;
  ownerKind: ExternalInterfaceOwnerKind;
  ownerId: string;
  displayName: string;
  category: ExternalInterfaceCategory;
  publicSchema: Readonly<Record<string, unknown>>;
  secretSchema: Readonly<Record<string, unknown>>;
  statusCheckKind: ExternalInterfaceStatusCheckKind;
  enabled: boolean;
}>;

type ExternalInterfaceBase = Readonly<{
  id: string;
  instanceId: string;
  typeKey: ExternalInterfaceTypeKey | string;
  ownerKind: ExternalInterfaceOwnerKind;
  ownerId: string;
  displayName: string;
  alias: string;
  enabled: boolean;
  isDefault: boolean;
  category: ExternalInterfaceCategory;
  baseUrl?: string;
  authMode?: string;
  statusCheckKind: ExternalInterfaceStatusCheckKind;
  visibleStatus: ExternalInterfaceVisibleStatus;
  lastCheckedAt?: string;
  lastCheckStatus?: ExternalInterfaceCheckStatus;
  lastCheckErrorCode?: string;
  lastCheckErrorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}>;

export type ExternalInterfaceSettingsRecord = ExternalInterfaceBase &
  Readonly<{
    publicConfig: Readonly<Record<string, unknown>>;
    secretConfigConfigured: Readonly<Record<string, boolean>>;
  }>;

export type ExternalInterfaceRecord = ExternalInterfaceBase &
  Readonly<{
    publicConfig: Readonly<Record<string, unknown>>;
    secretConfigCiphertext?: string;
  }>;

export type ResolvedExternalInterface = ExternalInterfaceBase &
  Readonly<{
    publicConfig: Readonly<Record<string, unknown>>;
    secretConfig: Readonly<Record<string, string>>;
  }>;

export type ExternalInterfaceConnectionCheckRecord = Readonly<{
  instanceId: string;
  interfaceId: string;
  checkedAt: string;
  checkStatus: ExternalInterfaceCheckStatus;
  visibleStatus: ExternalInterfaceVisibleStatus;
  errorCode?: string;
  errorMessage?: string;
}>;

export const externalInterfaceContract = {
  typeKeys: externalInterfaceTypeKeys,
  ownerKinds: externalInterfaceOwnerKinds,
  categories: externalInterfaceCategories,
  statusCheckKinds: externalInterfaceStatusCheckKinds,
  visibleStatuses: externalInterfaceVisibleStatuses,
  checkStatuses: externalInterfaceCheckStatuses,
  runtimeErrorCodes: externalInterfaceRuntimeErrorCodes,
  isTypeKey: (value: string): value is ExternalInterfaceTypeKey =>
    (externalInterfaceTypeKeys as readonly string[]).includes(value),
  isOwnerKind: (value: string): value is ExternalInterfaceOwnerKind =>
    (externalInterfaceOwnerKinds as readonly string[]).includes(value),
  isCategory: (value: string): value is ExternalInterfaceCategory =>
    (externalInterfaceCategories as readonly string[]).includes(value),
  isStatusCheckKind: (value: string): value is ExternalInterfaceStatusCheckKind =>
    (externalInterfaceStatusCheckKinds as readonly string[]).includes(value),
  isVisibleStatus: (value: string): value is ExternalInterfaceVisibleStatus =>
    (externalInterfaceVisibleStatuses as readonly string[]).includes(value),
  isCheckStatus: (value: string): value is ExternalInterfaceCheckStatus =>
    (externalInterfaceCheckStatuses as readonly string[]).includes(value),
  isRuntimeErrorCode: (value: string): value is ExternalInterfaceRuntimeErrorCode =>
    (externalInterfaceRuntimeErrorCodes as readonly string[]).includes(value),
} as const;
