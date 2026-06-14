const externalInterfaceTypeKeys = ['sva_mainserver', 's3', 'supabase', 'mail_transport'] as const;
const externalInterfaceOwnerKinds = ['host', 'plugin'] as const;
const externalInterfaceCategories = ['api', 'object_storage', 'database', 'feed'] as const;
const externalInterfaceStatusCheckKinds = ['none', 'sva_mainserver', 's3', 'supabase', 'mail_transport'] as const;
const externalInterfaceVisibleStatuses = ['not_configured', 'unknown', 'ok', 'error', 'disabled'] as const;
const externalInterfaceCheckStatuses = ['succeeded', 'failed'] as const;
const mailTransportTypes = ['smtp', 'provider_api'] as const;
const mailTransportSecurityModes = ['none', 'starttls', 'tls'] as const;
const mailTransportAuthModes = ['none', 'basic'] as const;
const mailDispatchAddressKinds = ['to', 'cc', 'bcc', 'reply_to'] as const;
const mailDispatchMessageKinds = ['transactional'] as const;
const externalInterfaceRuntimeErrorCodes = [
  'not_configured',
  'default_missing',
  'disabled',
  'secret_missing',
  'secret_unreadable',
  'project_url_invalid',
  'database_url_missing',
  'service_role_key_missing',
  'database_auth_failed',
  'database_host_unreachable',
  'schema_missing',
  'service_role_key_invalid',
  'rest_api_unreachable',
  'bucket_missing',
  's3_auth_failed',
  's3_endpoint_unreachable',
  'connection_failed',
] as const;

export type ExternalInterfaceTypeKey = (typeof externalInterfaceTypeKeys)[number];
export type ExternalInterfaceOwnerKind = (typeof externalInterfaceOwnerKinds)[number];
export type ExternalInterfaceCategory = (typeof externalInterfaceCategories)[number];
export type ExternalInterfaceStatusCheckKind = (typeof externalInterfaceStatusCheckKinds)[number];
export type ExternalInterfaceVisibleStatus = (typeof externalInterfaceVisibleStatuses)[number];
export type ExternalInterfaceCheckStatus = (typeof externalInterfaceCheckStatuses)[number];
export type ExternalInterfaceRuntimeErrorCode = (typeof externalInterfaceRuntimeErrorCodes)[number];
export type MailTransportType = (typeof mailTransportTypes)[number];
export type MailTransportSecurityMode = (typeof mailTransportSecurityModes)[number];
export type MailTransportAuthMode = (typeof mailTransportAuthModes)[number];
export type MailDispatchAddressKind = (typeof mailDispatchAddressKinds)[number];
export type MailDispatchMessageKind = (typeof mailDispatchMessageKinds)[number];

export type ExternalInterfaceTypeDefinition = Readonly<{
  typeKey: ExternalInterfaceTypeKey | string;
  ownerKind: ExternalInterfaceOwnerKind;
  ownerId: string;
  displayName: string;
  category: ExternalInterfaceCategory;
  publicSchema: Readonly<Record<string, unknown>>;
  secretSchema: Readonly<Record<string, unknown>>;
  statusCheckKind: ExternalInterfaceStatusCheckKind | string;
  enabled: boolean;
}>;

type ExternalInterfaceBase = Readonly<{
  id: string;
  instanceId: string;
  typeKey: ExternalInterfaceTypeKey;
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

export type MailTransportHealth = Readonly<{
  visibleStatus: ExternalInterfaceVisibleStatus;
  lastCheckedAt?: string;
  lastCheckStatus?: ExternalInterfaceCheckStatus;
  lastCheckErrorCode?: ExternalInterfaceRuntimeErrorCode | string;
  lastCheckErrorMessage?: string;
}>;

type MailTransportBaseConfig = Readonly<{
  transportId: string;
  displayName: string;
  securityMode: MailTransportSecurityMode;
  authMode: MailTransportAuthMode;
  username?: string;
  password?: string;
  defaultFromEmail?: string;
  defaultFromName?: string;
  defaultReplyToEmail?: string;
  maxBatchSize?: number;
  rateLimitPerMinute?: number;
  enabled: boolean;
  health?: MailTransportHealth;
}>;

export type MailTransportSmtpConfig = MailTransportBaseConfig &
  Readonly<{
    transportType: 'smtp';
    host: string;
    port: number;
  }>;

export type MailTransportProviderApiConfig = MailTransportBaseConfig &
  Readonly<{
    transportType: 'provider_api';
    endpoint: string;
    mode: string;
  }>;

export type MailTransportConfig = MailTransportSmtpConfig | MailTransportProviderApiConfig;

export type MailDispatchAddress = Readonly<{
  kind: MailDispatchAddressKind;
  email: string;
  displayName?: string;
}>;

export type MailDispatchPayload = Readonly<{
  orderId: string;
  transportId: string;
  messageKind: MailDispatchMessageKind;
  templateKey: string;
  locale?: string;
  addresses: readonly MailDispatchAddress[];
  templatePayload: Readonly<Record<string, string>>;
  tags?: readonly string[];
  metadata?: Readonly<Record<string, string>>;
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

export const mailTransportContract = {
  transportTypes: mailTransportTypes,
  securityModes: mailTransportSecurityModes,
  authModes: mailTransportAuthModes,
  isTransportType: (value: string): value is MailTransportType => (mailTransportTypes as readonly string[]).includes(value),
  isSecurityMode: (value: string): value is MailTransportSecurityMode =>
    (mailTransportSecurityModes as readonly string[]).includes(value),
  isAuthMode: (value: string): value is MailTransportAuthMode => (mailTransportAuthModes as readonly string[]).includes(value),
} as const;

export const mailDispatchContract = {
  addressKinds: mailDispatchAddressKinds,
  messageKinds: mailDispatchMessageKinds,
  isAddressKind: (value: string): value is MailDispatchAddressKind =>
    (mailDispatchAddressKinds as readonly string[]).includes(value),
  isMessageKind: (value: string): value is MailDispatchMessageKind =>
    (mailDispatchMessageKinds as readonly string[]).includes(value),
} as const;
