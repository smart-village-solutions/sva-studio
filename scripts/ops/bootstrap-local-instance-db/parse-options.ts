export type CliOptions = {
  createDb: boolean;
  importSchema: boolean;
  keycloakAdminClientId: string;
  keycloakAdminClientSecret: string;
  keycloakBaseUrl: string;
  pageSize: number;
  skipAppUserBootstrap: boolean;
  skipCatalogSync: boolean;
  skipKeycloakUserSync: boolean;
  sourceDbContainer: string;
  sourceDbName: string;
  sourceDbUser: string;
  sourceInstanceId: string;
  targetAppDbPassword: string;
  targetAppDbUser: string;
  targetDbContainer: string;
  targetDbName: string;
  targetDbUser: string;
  targetDisplayName: string;
  targetInstanceId: string;
  targetRealm: string;
};

export class BootstrapLocalInstanceDbCliError extends Error {
  readonly code: 'INVALID_ARGUMENT' | 'MISSING_REQUIRED_OPTION' | 'INVALID_NUMERIC_VALUE';

  constructor(code: BootstrapLocalInstanceDbCliError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export const renderUsage = (): string => `Usage: tsx scripts/ops/bootstrap-local-instance-db.ts \\
  --target-instance-id=<id> \\
  --target-realm=<realm> \\
  --keycloak-admin-client-id=<id> \\
  --keycloak-admin-client-secret=<secret> \\
  [--target-display-name=<name>] \\
  --target-db-container=<container> \\
  [--target-db-name=sva_studio] \\
  [--target-db-user=sva] \\
  [--target-app-db-user=sva_app] \\
  [--target-app-db-password=sva_app_local_dev_password] \\
  [--source-db-container=sva-studio-postgres] \\
  [--source-db-name=sva_studio] \\
  [--source-db-user=sva] \\
  [--source-instance-id=de-musterhausen] \\
  [--keycloak-base-url=https://keycloak.smart-village.app] \\
  [--page-size=200] \\
  [--create-db] \\
  [--import-schema] \\
  [--skip-app-user-bootstrap] \\
  [--skip-catalog-sync] \\
  [--skip-keycloak-user-sync]
`;

export const parseBootstrapLocalInstanceDbArgs = (args: readonly string[]): CliOptions => {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (const entry of args) {
    if (!entry.startsWith('--')) {
      throw new BootstrapLocalInstanceDbCliError('INVALID_ARGUMENT', `Ungültiges Argument: ${entry}`);
    }

    const separatorIndex = entry.indexOf('=');
    if (separatorIndex === -1) {
      flags.add(entry.slice(2));
      continue;
    }

    values.set(entry.slice(2, separatorIndex), entry.slice(separatorIndex + 1));
  }

  const readRequired = (key: string): string => {
    const value = values.get(key);
    if (!value) {
      throw new BootstrapLocalInstanceDbCliError('MISSING_REQUIRED_OPTION', `Missing required option --${key}=...`);
    }

    return value;
  };

  const readString = (key: string, fallback: string) => values.get(key) ?? fallback;
  const readNumber = (key: string, fallback: number): number => {
    const raw = values.get(key);
    if (!raw) {
      return fallback;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BootstrapLocalInstanceDbCliError('INVALID_NUMERIC_VALUE', `Invalid numeric value for --${key}: ${raw}`);
    }

    return parsed;
  };

  const targetInstanceId = readRequired('target-instance-id');

  return {
    createDb: flags.has('create-db'),
    importSchema: flags.has('import-schema'),
    keycloakAdminClientId: readRequired('keycloak-admin-client-id'),
    keycloakAdminClientSecret: readRequired('keycloak-admin-client-secret'),
    keycloakBaseUrl: readString('keycloak-base-url', 'https://keycloak.smart-village.app'),
    pageSize: readNumber('page-size', 200),
    skipAppUserBootstrap: flags.has('skip-app-user-bootstrap'),
    skipCatalogSync: flags.has('skip-catalog-sync'),
    skipKeycloakUserSync: flags.has('skip-keycloak-user-sync'),
    sourceDbContainer: readString('source-db-container', 'sva-studio-postgres'),
    sourceDbName: readString('source-db-name', 'sva_studio'),
    sourceDbUser: readString('source-db-user', 'sva'),
    sourceInstanceId: readString('source-instance-id', 'de-musterhausen'),
    targetAppDbPassword: readString('target-app-db-password', 'sva_app_local_dev_password'),
    targetAppDbUser: readString('target-app-db-user', 'sva_app'),
    targetDbContainer: readRequired('target-db-container'),
    targetDbName: readString('target-db-name', 'sva_studio'),
    targetDbUser: readString('target-db-user', 'sva'),
    targetDisplayName: readString('target-display-name', targetInstanceId),
    targetInstanceId,
    targetRealm: readRequired('target-realm'),
  };
};
