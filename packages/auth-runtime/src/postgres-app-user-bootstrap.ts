import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { createSdkLogger } from '@sva/server-runtime';

import { getAppDbPassword } from './runtime-secrets.js';

const logger = createSdkLogger({ component: 'iam-db-bootstrap', level: 'info' });

let bootstrapPromise: Promise<boolean> | null = null;
const BOOTSTRAP_RUNTIME_PROFILES = new Set(['studio', 'local-keycloak', 'local-builder']);

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const quoteLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

const readPasswordFile = (filePath: string | undefined): string | undefined => {
  if (!filePath) {
    return undefined;
  }

  try {
    const value = readFileSync(filePath, 'utf8').trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
};

const readPostgresSuperuserPasswords = (): readonly string[] => {
  const candidates = [
    process.env.POSTGRES_PASSWORD?.trim(),
    readPasswordFile(process.env.POSTGRES_PASSWORD_FILE?.trim()),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
};

const shouldAttemptStudioBootstrap = (error: unknown): boolean => {
  const runtimeProfile = process.env.SVA_RUNTIME_PROFILE?.trim();
  if (!runtimeProfile || !BOOTSTRAP_RUNTIME_PROFILES.has(runtimeProfile)) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('password authentication failed for user "sva_app"') ||
    message.includes('permission denied for database')
  );
};

const resolveBootstrapTarget = (): { host: string; port: number; database: string } => {
  const explicitUrl = process.env.IAM_DATABASE_URL?.trim();
  if (explicitUrl) {
    try {
      const parsed = new URL(explicitUrl);
      return {
        host: parsed.hostname,
        port: parsed.port ? Number.parseInt(parsed.port, 10) || 5432 : 5432,
        database: decodeURIComponent(parsed.pathname.replace(/^\//u, '')) || 'sva_studio',
      };
    } catch {
      // Fall back to the explicit runtime env below.
    }
  }

  return {
    host: process.env.POSTGRES_HOST?.trim() || 'postgres',
    port: Number.parseInt(process.env.POSTGRES_PORT?.trim() || '5432', 10) || 5432,
    database: process.env.POSTGRES_DB?.trim() || 'sva_studio',
  };
};

const runBootstrap = async (): Promise<boolean> => {
  const superuserPasswords = readPostgresSuperuserPasswords();
  const appDbPassword = getAppDbPassword();
  const appDbUser = process.env.APP_DB_USER?.trim() || 'sva_app';
  const postgresUser = process.env.POSTGRES_USER?.trim() || 'sva';
  const bootstrapTarget = resolveBootstrapTarget();
  const postgresDb = bootstrapTarget.database;

  if (superuserPasswords.length === 0 || !appDbPassword) {
    return false;
  }

  const quotedAppDbUser = quoteIdentifier(appDbUser);
  const quotedAppDbPassword = quoteLiteral(appDbPassword);
  const quotedPostgresDb = quoteIdentifier(postgresDb);
  let lastError: unknown;

  for (const superuserPassword of superuserPasswords) {
    const client = new Client({
      host: bootstrapTarget.host,
      port: bootstrapTarget.port,
      database: postgresDb,
      user: postgresUser,
      password: superuserPassword,
    });

    try {
      await client.connect();
      const existingRole = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1 LIMIT 1;', [appDbUser]);
      if (existingRole.rowCount === 0) {
        await client.query(
          `CREATE ROLE ${quotedAppDbUser} LOGIN PASSWORD ${quotedAppDbPassword} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`
        );
      } else {
        await client.query(
          `ALTER ROLE ${quotedAppDbUser} WITH LOGIN PASSWORD ${quotedAppDbPassword} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`
        );
      }
      await client.query(`GRANT CONNECT ON DATABASE ${quotedPostgresDb} TO ${quotedAppDbUser}`);
      await client.query(`GRANT CREATE ON DATABASE ${quotedPostgresDb} TO ${quotedAppDbUser}`);
      await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${quotedAppDbUser}`);
      await client.query(`GRANT iam_app TO ${quotedAppDbUser}`);
      await client.query(`GRANT USAGE ON SCHEMA iam TO ${quotedAppDbUser}`);
      await client.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA iam TO ${quotedAppDbUser}`
      );
      await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA iam TO ${quotedAppDbUser}`);
      logger.info('Bootstrapped studio app DB role', {
        operation: 'studio_db_bootstrap',
        app_db_user: appDbUser,
        database: postgresDb,
      });
      return true;
    } catch (error) {
      lastError = error;
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'DB bootstrap failed'));
};

export const bootstrapStudioAppDbUserIfNeeded = async (error: unknown): Promise<boolean> => {
  if (!shouldAttemptStudioBootstrap(error)) {
    return false;
  }

  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap()
      .catch((bootstrapError) => {
        logger.warn('Studio DB bootstrap failed', {
          operation: 'studio_db_bootstrap',
          error: bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError),
        });
        return false;
      })
      .finally(() => {
        bootstrapPromise = null;
      });
  }

  return bootstrapPromise;
};
