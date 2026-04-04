import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';

import { isInstanceStatus, type InstanceStatus } from '../../packages/core/src/instances/registry.js';
import { createInstanceRegistryService } from '../../packages/auth/src/iam-instance-registry/service.js';
import { createInstanceRegistryRepository } from '../../packages/data/src/instance-registry/index.js';
import { invalidateInstanceRegistryHost } from '../../packages/data/src/instance-registry/server.js';
import { createSdkLogger } from '../../packages/sdk/src/logger/index.server.js';

import type { SqlExecutor, SqlStatement } from '../../packages/data/src/iam/repositories/types.js';

type Command = 'list' | 'create' | 'activate' | 'suspend' | 'archive';

type CliOptions = {
  readonly actorId?: string;
  readonly authClientId?: string;
  readonly authIssuerUrl?: string;
  readonly authRealm?: string;
  readonly command: Command;
  readonly displayName?: string;
  readonly featureFlags?: Readonly<Record<string, boolean>>;
  readonly idempotencyKey: string;
  readonly instanceId?: string;
  readonly jsonOutput: boolean;
  readonly mainserverConfigRef?: string;
  readonly parentDomain?: string;
  readonly search?: string;
  readonly status?: InstanceStatus;
  readonly themeKey?: string;
};

const logger = createSdkLogger({ component: 'instance-registry-cli', level: 'info' });

const readOptionValue = (args: readonly string[], index: number) => {
  const current = args[index];
  if (!current) {
    throw new Error('Fehlende Option.');
  }
  const [flag, inlineValue] = current.split('=', 2);
  if (inlineValue !== undefined) {
    return { flag, nextIndex: index, value: inlineValue };
  }
  const next = args[index + 1];
  if (!next || next.startsWith('--')) {
    throw new Error(`Option ${flag} erwartet einen Wert.`);
  }
  return { flag, nextIndex: index + 1, value: next };
};

const parseFeatureFlags = (raw?: string): Readonly<Record<string, boolean>> | undefined => {
  if (!raw) {
    return undefined;
  }

  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [key, value] = entry.split('=', 2);
      if (!key || (value !== 'true' && value !== 'false')) {
        throw new Error(`Ungültiges Feature-Flag-Format: ${entry}. Erwartet wird key=true|false.`);
      }
      return [key, value === 'true'] as const;
    });

  return Object.fromEntries(entries);
};

const parseCliOptions = (argv: readonly string[]): CliOptions => {
  const [commandRaw, ...rawOptions] = argv;
  if (!commandRaw || !['list', 'create', 'activate', 'suspend', 'archive'].includes(commandRaw)) {
    throw new Error('Befehl fehlt oder ist ungültig. Erlaubt: list, create, activate, suspend, archive.');
  }

  const parsed: {
    actorId?: string;
    authClientId?: string;
    authIssuerUrl?: string;
    authRealm?: string;
    displayName?: string;
    featureFlagsRaw?: string;
    instanceId?: string;
    jsonOutput: boolean;
    mainserverConfigRef?: string;
    parentDomain?: string;
    search?: string;
    status?: string;
    themeKey?: string;
    idempotencyKey?: string;
  } = {
    jsonOutput: false,
  };

  for (let index = 0; index < rawOptions.length; index += 1) {
    const option = rawOptions[index];
    if (option === '--json') {
      parsed.jsonOutput = true;
      continue;
    }

    const { flag, nextIndex, value } = readOptionValue(rawOptions, index);
    index = nextIndex;

    switch (flag) {
      case '--actor-id':
        parsed.actorId = value;
        break;
      case '--auth-client-id':
        parsed.authClientId = value;
        break;
      case '--auth-issuer-url':
        parsed.authIssuerUrl = value;
        break;
      case '--auth-realm':
        parsed.authRealm = value;
        break;
      case '--instance-id':
        parsed.instanceId = value;
        break;
      case '--display-name':
        parsed.displayName = value;
        break;
      case '--parent-domain':
        parsed.parentDomain = value;
        break;
      case '--theme-key':
        parsed.themeKey = value;
        break;
      case '--mainserver-config-ref':
        parsed.mainserverConfigRef = value;
        break;
      case '--feature-flags':
        parsed.featureFlagsRaw = value;
        break;
      case '--search':
        parsed.search = value;
        break;
      case '--status':
        parsed.status = value;
        break;
      case '--idempotency-key':
        parsed.idempotencyKey = value;
        break;
      default:
        throw new Error(`Unbekannte Option: ${flag}`);
    }
  }

  return {
    actorId: parsed.actorId,
    authClientId: parsed.authClientId,
    authIssuerUrl: parsed.authIssuerUrl,
    authRealm: parsed.authRealm,
    command: commandRaw as Command,
    displayName: parsed.displayName,
    featureFlags: parseFeatureFlags(parsed.featureFlagsRaw),
    idempotencyKey: parsed.idempotencyKey ?? randomUUID(),
    instanceId: parsed.instanceId,
    jsonOutput: parsed.jsonOutput,
    mainserverConfigRef: parsed.mainserverConfigRef,
    parentDomain: parsed.parentDomain,
    search: parsed.search,
    status: parseStatusOption(parsed.status),
    themeKey: parsed.themeKey,
  };
};

const assertRequired = (value: string | undefined, flag: string): string => {
  if (!value?.trim()) {
    throw new Error(`Option ${flag} ist erforderlich.`);
  }
  return value.trim();
};

const parseStatusOption = (value: string | undefined): InstanceStatus | undefined => {
  if (!value) {
    return undefined;
  }

  if (!isInstanceStatus(value)) {
    throw new Error(`Ungültiger Statuswert für --status: ${value}.`);
  }

  return value;
};

const renderResult = (jsonOutput: boolean, payload: unknown) => {
  if (jsonOutput) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      console.log(JSON.stringify(item));
    }
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
};

const createExecutor = (pool: Pool): SqlExecutor => ({
  async execute(statement) {
    const result = await pool.query(statement.text, [...statement.values]);
    return {
      rowCount: result.rowCount ?? 0,
      rows: result.rows,
    };
  },
});

const withTransaction = async <T>(pool: Pool, work: (service: ReturnType<typeof createInstanceRegistryService>) => Promise<T>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const repository = createInstanceRegistryRepository({
      execute: async <TRow = Record<string, unknown>>(statement: SqlStatement) => {
        const result = await client.query(statement.text, [...statement.values]);
        return {
          rowCount: result.rowCount ?? 0,
          rows: result.rows as readonly TRow[],
        };
      },
    });
    const service = createInstanceRegistryService({
      repository,
      invalidateHost: invalidateInstanceRegistryHost,
    });
    const result = await work(service);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.warn('Instance registry CLI rollback failed', {
        error_type: rollbackError instanceof Error ? rollbackError.constructor.name : typeof rollbackError,
        error_message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }
    throw error;
  } finally {
    client.release();
  }
};

const run = async () => {
  const options = parseCliOptions(process.argv.slice(2));
  const databaseUrl = process.env['IAM_DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('IAM_DATABASE_URL ist nicht gesetzt.');
  }

  const pool = new Pool({ connectionString: databaseUrl, max: 2, idleTimeoutMillis: 5_000 });

  try {
    if (options.command === 'list') {
      const repository = createInstanceRegistryRepository(createExecutor(pool));
      const service = createInstanceRegistryService({
        repository,
        invalidateHost: invalidateInstanceRegistryHost,
      });
      const instances = await service.listInstances({
        search: options.search,
        status: options.status,
      });
      renderResult(options.jsonOutput, instances);
      return;
    }

    const result = await withTransaction(pool, async (service) => {
      switch (options.command) {
        case 'create':
          return service.createProvisioningRequest({
            actorId: options.actorId,
            authClientId: assertRequired(options.authClientId, '--auth-client-id'),
            authIssuerUrl: options.authIssuerUrl,
            authRealm: assertRequired(options.authRealm, '--auth-realm'),
            displayName: assertRequired(options.displayName, '--display-name'),
            featureFlags: options.featureFlags,
            idempotencyKey: options.idempotencyKey,
            instanceId: assertRequired(options.instanceId, '--instance-id'),
            mainserverConfigRef: options.mainserverConfigRef,
            parentDomain: assertRequired(options.parentDomain, '--parent-domain'),
            requestId: `cli-${options.idempotencyKey}`,
            themeKey: options.themeKey,
          });
        case 'activate':
        case 'suspend':
        case 'archive':
          return service.changeStatus({
            actorId: options.actorId,
            idempotencyKey: options.idempotencyKey,
            instanceId: assertRequired(options.instanceId, '--instance-id'),
            nextStatus: options.command === 'activate' ? 'active' : options.command === 'suspend' ? 'suspended' : 'archived',
            requestId: `cli-${options.idempotencyKey}`,
          });
      }
    });

    logger.info('Instance registry CLI operation completed', {
      operation: `instance_registry_cli_${options.command}`,
      instance_id: options.instanceId,
      actor_id: options.actorId,
      idempotency_key: options.idempotencyKey,
    });
    renderResult(options.jsonOutput, result);
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  logger.error('Instance registry CLI failed', {
    error_type: error instanceof Error ? error.constructor.name : typeof error,
    error_message: error instanceof Error ? error.message : String(error),
  });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
