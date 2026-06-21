import type {
  MailTransportAuthMode,
  MailTransportSecurityMode,
} from '@sva/core';
import type { SvaMainserverConnectionStatus } from '@sva/sva-mainserver';

export type InstanceInterfaceType = 'mainserver' | 's3' | 'supabase' | 'mailTransport' | 'mapGeocoding';

export type InstanceInterfaceStatus = 'connected' | 'error' | 'disabled' | 'unknown';

export type InstanceInterfaceMainserverConfig = Readonly<{
  graphqlBaseUrl: string;
  oauthTokenUrl: string;
}>;

export type InstanceInterfaceS3Config = Readonly<{
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  forcePathStyle: boolean;
}>;

export type InstanceInterfaceSupabaseConfig = Readonly<{
  projectUrl: string;
  schemaName: string;
  databaseUrl: string;
}>;

export type InstanceInterfaceMailTransportConfig = Readonly<{
  transportId: string;
  host: string;
  port: string;
  securityMode: MailTransportSecurityMode;
  authMode: MailTransportAuthMode;
  username: string;
  defaultFromEmail: string;
  defaultFromName: string;
  defaultReplyToEmail: string;
  maxBatchSize: string;
  rateLimitPerMinute: string;
}>;

export type InstanceInterfaceMapGeocodingConfig = Readonly<{
  provider: 'geoapify' | 'custom';
  styleUrl: string;
  autocompleteEnabled: boolean;
  geocodeEnabled: boolean;
  reverseGeocodeEnabled: boolean;
  suggestEndpoint: string;
  geocodeEndpoint: string;
  reverseGeocodeEndpoint: string;
  requestTimeoutMs: string;
  rateLimitPerMinute: string;
  killSwitchEnabled: boolean;
}>;

type InstanceInterfaceBase = Readonly<{
  id: string;
  instanceId: string;
  name: string;
  enabled: boolean;
  status: InstanceInterfaceStatus;
  statusMessage?: string;
  errorCode?: SvaMainserverConnectionStatus['errorCode'];
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type InstanceInterfaceMainserver = InstanceInterfaceBase & Readonly<{
  type: 'mainserver';
  config: InstanceInterfaceMainserverConfig;
}>;

export type InstanceInterfaceS3 = InstanceInterfaceBase & Readonly<{
  type: 's3';
  config: InstanceInterfaceS3Config;
}>;

export type InstanceInterfaceSupabase = InstanceInterfaceBase & Readonly<{
  type: 'supabase';
  config: InstanceInterfaceSupabaseConfig;
}>;

export type InstanceInterfaceMailTransport = InstanceInterfaceBase & Readonly<{
  type: 'mailTransport';
  config: InstanceInterfaceMailTransportConfig;
}>;

export type InstanceInterfaceMapGeocoding = InstanceInterfaceBase & Readonly<{
  type: 'mapGeocoding';
  config: InstanceInterfaceMapGeocodingConfig;
}>;

export type InstanceInterface =
  | InstanceInterfaceMainserver
  | InstanceInterfaceS3
  | InstanceInterfaceSupabase
  | InstanceInterfaceMailTransport
  | InstanceInterfaceMapGeocoding;

export type InstanceInterfaceDraft =
  | { type: 'mainserver'; name: string; enabled: boolean; config: InstanceInterfaceMainserverConfig }
  | { type: 's3'; name: string; enabled: boolean; config: InstanceInterfaceS3Config & { secretAccessKey: string } }
  | { type: 'supabase'; name: string; enabled: boolean; config: InstanceInterfaceSupabaseConfig & { serviceRoleKey: string } }
  | { type: 'mailTransport'; name: string; enabled: boolean; config: InstanceInterfaceMailTransportConfig & { password: string } }
  | { type: 'mapGeocoding'; name: string; enabled: boolean; config: InstanceInterfaceMapGeocodingConfig & { apiKey: string } };

export const instanceInterfaceTypeMeta: Record<InstanceInterfaceType, { titleKey: string; descriptionKey: string }> = {
  mainserver: {
    titleKey: 'interfaces.types.mainserver.label',
    descriptionKey: 'interfaces.types.mainserver.description',
  },
  s3: {
    titleKey: 'interfaces.types.s3.label',
    descriptionKey: 'interfaces.types.s3.description',
  },
  supabase: {
    titleKey: 'interfaces.types.supabase.label',
    descriptionKey: 'interfaces.types.supabase.description',
  },
  mailTransport: {
    titleKey: 'interfaces.types.mailTransport.label',
    descriptionKey: 'interfaces.types.mailTransport.description',
  },
  mapGeocoding: {
    titleKey: 'interfaces.types.mapGeocoding.label',
    descriptionKey: 'interfaces.types.mapGeocoding.description',
  },
};

export const createEmptyInstanceInterfaceDraft = (
  type: InstanceInterfaceType
): InstanceInterfaceDraft => {
  if (type === 'mainserver') {
    return {
      type: 'mainserver',
      name: 'Mainserver',
      enabled: true,
      config: { graphqlBaseUrl: '', oauthTokenUrl: '' },
    };
  }
  if (type === 's3') {
    return {
      type: 's3',
      name: 'S3 Storage',
      enabled: true,
      config: {
        endpoint: '',
        region: 'eu-central-1',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: false,
      },
    };
  }
  if (type === 'mailTransport') {
    return {
      type: 'mailTransport',
      name: 'Mail-Transport',
      enabled: true,
      config: {
        transportId: '',
        host: '',
        port: '587',
        securityMode: 'starttls',
        authMode: 'basic',
        username: '',
        password: '',
        defaultFromEmail: '',
        defaultFromName: '',
        defaultReplyToEmail: '',
        maxBatchSize: '',
        rateLimitPerMinute: '',
      },
    };
  }
  if (type === 'mapGeocoding') {
    return {
      type: 'mapGeocoding',
      name: 'Karte & Geocoding',
      enabled: true,
      config: {
        provider: 'geoapify',
        styleUrl: 'https://tileserver-gl.smart-village.app/styles/osm-bright/',
        autocompleteEnabled: true,
        geocodeEnabled: true,
        reverseGeocodeEnabled: true,
        suggestEndpoint: '',
        geocodeEndpoint: '',
        reverseGeocodeEndpoint: '',
        requestTimeoutMs: '3000',
        rateLimitPerMinute: '60',
        killSwitchEnabled: false,
        apiKey: '',
      },
    };
  }
  return {
    type: 'supabase',
    name: 'Supabase',
    enabled: true,
    config: {
      projectUrl: '',
      schemaName: 'public',
      databaseUrl: '',
      serviceRoleKey: '',
    },
  };
};
