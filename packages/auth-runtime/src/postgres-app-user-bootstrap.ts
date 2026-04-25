import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { createSdkLogger } from '@sva/server-runtime';

import { getAppDbPassword } from './runtime-secrets.js';

const logger = createSdkLogger({ component: 'iam-db-bootstrap', level: 'info' });

let bootstrapPromise: Promise<boolean> | null = null;

const quoteIdentifier = (value: string): string => `"${value.replace(/"/g, '""')}"`;

const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;

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
  if (process.env.SVA_RUNTIME_PROFILE !== 'studio') {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes('password authentication failed for user "sva_app"');
};

const runBootstrap = async (): Promise<boolean> => {
  const superuserPasswords = readPostgresSuperuserPasswords();
  const appDbPassword = getAppDbPassword();
  const appDbUser = process.env.APP_DB_USER?.trim() || 'sva_app';
  const postgresUser = process.env.POSTGRES_USER?.trim() || 'sva';
  const postgresDb = process.env.POSTGRES_DB?.trim() || 'sva_studio';

  if (superuserPasswords.length === 0 || !appDbPassword) {
    return false;
  }

  const quotedAppDbUser = quoteIdentifier(appDbUser);
  const quotedAppDbPassword = quoteLiteral(appDbPassword);
  const quotedRoleName = quoteLiteral(appDbUser);
  let lastError: unknown;

  for (const superuserPassword of superuserPasswords) {
    const client = new Client({
      host: 'postgres',
      port: 5432,
      database: postgresDb,
      user: postgresUser,
      password: superuserPassword,
    });

    try {
      await client.connect();
      await client.query(
        `
DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${quotedRoleName}) THEN
    EXECUTE format(
      'CREATE ROLE ${quotedAppDbUser} LOGIN PASSWORD ${quotedAppDbPassword} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE ${quotedAppDbUser} WITH LOGIN PASSWORD ${quotedAppDbPassword} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT'
    );
  END IF;
END
$bootstrap$;
`
      );
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
