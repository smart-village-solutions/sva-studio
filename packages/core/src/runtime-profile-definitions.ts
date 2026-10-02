export const RUNTIME_PROFILES = ['local-keycloak', 'local-builder', 'studio'] as const;

export type RuntimeProfile = (typeof RUNTIME_PROFILES)[number];
export type RuntimeProfileAuthMode = 'keycloak' | 'mock';

export type RuntimeProfileDefinition = {
  readonly authMode: RuntimeProfileAuthMode;
  readonly description: string;
  readonly isLocal: boolean;
  readonly requiredEnvKeys: readonly string[];
  readonly usesBuilder: boolean;
};

export type RuntimeProfileEnvValidationResult = {
  readonly derived: string[];
  readonly invalid: string[];
  readonly missing: string[];
  readonly placeholders: string[];
};

const COMMON_REQUIRED_ENV_KEYS = [
  'SVA_RUNTIME_PROFILE',
  'SVA_PUBLIC_BASE_URL',
  'IAM_PII_ACTIVE_KEY_ID',
  'IAM_PII_KEYRING_JSON',
  'ENCRYPTION_KEY',
  'SVA_MAINSERVER_GRAPHQL_URL',
  'SVA_MAINSERVER_OAUTH_TOKEN_URL',
  'SVA_MAINSERVER_CLIENT_ID',
  'SVA_MAINSERVER_CLIENT_SECRET',
] as const;

const LOCAL_CONNECTION_REQUIRED_ENV_KEYS = ['REDIS_URL', 'IAM_DATABASE_URL'] as const;

const REMOTE_CONNECTION_REQUIRED_ENV_KEYS = [
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'APP_DB_USER',
  'APP_DB_PASSWORD',
  'REDIS_PASSWORD',
  'SVA_STACK_NAME',
  'QUANTUM_ENDPOINT',
] as const;

const KEYCLOAK_AUTH_REQUIRED_ENV_KEYS = [
  'SVA_AUTH_ISSUER',
  'SVA_AUTH_CLIENT_ID',
  'SVA_AUTH_CLIENT_SECRET',
  'SVA_AUTH_STATE_SECRET',
  'SVA_AUTH_REDIRECT_URI',
  'SVA_AUTH_POST_LOGOUT_REDIRECT_URI',
] as const;

const KEYCLOAK_ADMIN_REQUIRED_ENV_KEYS = [
  'KEYCLOAK_ADMIN_BASE_URL',
  'KEYCLOAK_ADMIN_REALM',
  'KEYCLOAK_ADMIN_CLIENT_ID',
  'KEYCLOAK_ADMIN_CLIENT_SECRET',
] as const;

export const PROFILE_DEFINITIONS = {
  'local-keycloak': {
    authMode: 'keycloak',
    description: 'Lokaler Betrieb auf localhost mit Test-Realm in Keycloak.',
    isLocal: true,
    requiredEnvKeys: [
      ...COMMON_REQUIRED_ENV_KEYS,
      ...LOCAL_CONNECTION_REQUIRED_ENV_KEYS,
      ...KEYCLOAK_AUTH_REQUIRED_ENV_KEYS,
      ...KEYCLOAK_ADMIN_REQUIRED_ENV_KEYS,
    ],
    usesBuilder: false,
  },
  'local-builder': {
    authMode: 'mock',
    description: 'Lokaler Betrieb mit Builder.io und Mock-User statt OIDC-Login.',
    isLocal: true,
    requiredEnvKeys: [
      ...COMMON_REQUIRED_ENV_KEYS,
      ...LOCAL_CONNECTION_REQUIRED_ENV_KEYS,
      ...KEYCLOAK_ADMIN_REQUIRED_ENV_KEYS,
      'SVA_MOCK_AUTH',
      'VITE_MOCK_AUTH',
      'VITE_PUBLIC_BUILDER_KEY',
    ],
    usesBuilder: true,
  },
  studio: {
    authMode: 'keycloak',
    description: 'Produktionsnaher Serverbetrieb fuer Studio auf eigener Domain und eigenem Stack.',
    isLocal: false,
    requiredEnvKeys: [
      ...COMMON_REQUIRED_ENV_KEYS,
      ...REMOTE_CONNECTION_REQUIRED_ENV_KEYS,
      'SVA_AUTH_CLIENT_SECRET',
      'SVA_AUTH_STATE_SECRET',
      'SVA_AUTH_REDIRECT_URI',
      'SVA_AUTH_POST_LOGOUT_REDIRECT_URI',
      'KEYCLOAK_ADMIN_BASE_URL',
      'KEYCLOAK_ADMIN_REALM',
      'KEYCLOAK_ADMIN_CLIENT_SECRET',
      'KEYCLOAK_ADMIN_CLIENT_ID',
      'SVA_PARENT_DOMAIN',
    ],
    usesBuilder: false,
  },
} satisfies Record<RuntimeProfile, RuntimeProfileDefinition>;
