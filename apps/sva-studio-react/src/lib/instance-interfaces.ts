import { z } from 'zod';
import {
  APP_TRANSLATION_MAX_LOCALES,
  appTranslationLanguage,
  isAppTranslationLocale,
} from '@sva/core';
import type { DeepLSettings, MailTransportAuthMode, MailTransportSecurityMode } from '@sva/core';

export type InstanceInterfaceType =
  'deepl' | 'mainserver' | 's3' | 'supabase' | 'postgresql' | 'mailTransport' | 'mapGeocoding';

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

export type InstanceInterfacePostgresqlConfig = Readonly<{
  schemaName: string;
  databaseUrl: string;
}>;

export type InstanceInterfaceMailTransportConfig = Readonly<{
  transportId: string;
  transportType?: string;
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
  errorCode?: string;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type InstanceInterfaceMainserver = InstanceInterfaceBase &
  Readonly<{
    type: 'mainserver';
    config: InstanceInterfaceMainserverConfig;
  }>;

export type InstanceInterfaceS3 = InstanceInterfaceBase &
  Readonly<{
    type: 's3';
    config: InstanceInterfaceS3Config;
  }>;

export type InstanceInterfaceSupabase = InstanceInterfaceBase &
  Readonly<{
    type: 'supabase';
    config: InstanceInterfaceSupabaseConfig;
  }>;

export type InstanceInterfacePostgresql = InstanceInterfaceBase &
  Readonly<{
    type: 'postgresql';
    config: InstanceInterfacePostgresqlConfig;
  }>;

export type InstanceInterfaceMailTransport = InstanceInterfaceBase &
  Readonly<{
    type: 'mailTransport';
    config: InstanceInterfaceMailTransportConfig;
  }>;

export type InstanceInterfaceMapGeocoding = InstanceInterfaceBase &
  Readonly<{
    type: 'mapGeocoding';
    apiKeyConfigured?: boolean;
    config: InstanceInterfaceMapGeocodingConfig;
  }>;

export type InstanceInterfaceDeepL = InstanceInterfaceBase &
  Readonly<{ type: 'deepl'; apiKeyConfigured: boolean; config: DeepLSettings }>;

export type InstanceInterface =
  | InstanceInterfaceDeepL
  | InstanceInterfaceMainserver
  | InstanceInterfaceS3
  | InstanceInterfaceSupabase
  | InstanceInterfacePostgresql
  | InstanceInterfaceMailTransport
  | InstanceInterfaceMapGeocoding;

export type InstanceInterfaceDraft =
  | {
      type: 'deepl';
      name: string;
      enabled: boolean;
      config: Pick<DeepLSettings, 'plan' | 'englishVariant' | 'selectedLocales' | 'revision'> & {
        apiKey: string;
      };
    }
  | {
      type: 'mainserver';
      name: string;
      enabled: boolean;
      config: InstanceInterfaceMainserverConfig;
    }
  | {
      type: 's3';
      name: string;
      enabled: boolean;
      config: InstanceInterfaceS3Config & { secretAccessKey: string };
    }
  | {
      type: 'supabase';
      name: string;
      enabled: boolean;
      config: InstanceInterfaceSupabaseConfig & { serviceRoleKey: string };
    }
  | {
      type: 'postgresql';
      name: string;
      enabled: boolean;
      config: InstanceInterfacePostgresqlConfig;
    }
  | {
      type: 'mailTransport';
      name: string;
      enabled: boolean;
      config: InstanceInterfaceMailTransportConfig & { password: string };
    }
  | {
      type: 'mapGeocoding';
      name: string;
      enabled: boolean;
      config: InstanceInterfaceMapGeocodingConfig & { apiKey: string };
    };

export const instanceInterfaceTypeMeta: Record<
  InstanceInterfaceType,
  { titleKey: string; descriptionKey: string }
> = {
  deepl: {
    titleKey: 'interfaces.types.deepl.label',
    descriptionKey: 'interfaces.types.deepl.description',
  },
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
  postgresql: {
    titleKey: 'interfaces.types.postgresql.label',
    descriptionKey: 'interfaces.types.postgresql.description',
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
  if (type === 'deepl')
    return {
      type: 'deepl',
      name: 'DeepL',
      enabled: true,
      config: {
        plan: 'pro',
        englishVariant: 'en-GB',
        selectedLocales: [],
        apiKey: '',
        revision: '0',
      },
    };
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
  if (type === 'postgresql') {
    return {
      type: 'postgresql',
      name: 'PostgreSQL',
      enabled: true,
      config: {
        schemaName: 'public',
        databaseUrl: '',
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
        styleUrl: 'https://tileserver-gl.smart-village.app/styles/osm-bright/style.json',
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

export const deepLInterfaceDraftSchema = z
  .object({
    type: z.literal('deepl'),
    name: z.string().trim().min(1).max(120),
    enabled: z.boolean(),
    config: z
      .object({
        plan: z.enum(['free', 'pro']),
        englishVariant: z.enum(['en-GB', 'en-US']),
        selectedLocales: z
          .array(
            z
              .string()
              .refine(
                (locale) =>
                  isAppTranslationLocale(locale) && appTranslationLanguage(locale) !== 'de'
              )
          )
          .max(APP_TRANSLATION_MAX_LOCALES)
          .refine(
            (locales) =>
              locales.every(isAppTranslationLocale) &&
              new Set(locales.map(appTranslationLanguage)).size === locales.length
          ),
        revision: z.string().min(1).max(128),
        apiKey: z.string().max(4096),
      })
      .strict(),
  })
  .strict();
