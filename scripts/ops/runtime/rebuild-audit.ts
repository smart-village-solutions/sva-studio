import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import type { CliOptions as BootstrapLocalInstanceDbCliOptions } from '../bootstrap-local-instance-db/parse-options.js';
import type { DeleteLocalInstanceCliOptions } from '../delete-local-instance-db.js';

type AuditScalar = boolean | number | string | null;
type AuditValue = AuditScalar | readonly AuditValue[] | { readonly [key: string]: AuditValue | undefined };

export type RebuildAuditScope = 'local-instance-db-bootstrap' | 'local-instance-db-delete' | 'local-runtime';
export type RebuildAuditStatus = 'completed' | 'failed' | 'started';

export type RebuildAuditEvent = Readonly<{
  at: string;
  command: string;
  details?: Readonly<Record<string, AuditValue>>;
  error?: string;
  gitSha?: string;
  phase: string;
  pid: number;
  profile?: string;
  reason: string;
  scope: RebuildAuditScope;
  status: RebuildAuditStatus;
  targetInstanceId?: string;
}>;

type AuditDetails = Readonly<Record<string, AuditValue>>;
export type LocalRuntimeAuditCommand = 'down' | 'migrate' | 'reconcile' | 'repair' | 'up' | 'update';
const LOCAL_RUNTIME_AUDIT_COMMANDS = ['down', 'migrate', 'reconcile', 'repair', 'up', 'update'] as const;
const LOCAL_RUNTIME_AUDIT_REASONS: Readonly<Record<LocalRuntimeAuditCommand, string>> = {
  down: 'Lokaler Stopp beendet Dev-Server, Worker und Compose-Stack.',
  migrate: 'Lokale Migration mutiert das Datenbankschema und bootstrappt den App-User neu.',
  reconcile: 'Explizite lokale Registry-Reconcile passt die Instanz-Identitaet an das Sollbild an.',
  repair: 'Lokaler Repair heilt Migration, Registry-Drift und Tenant-Secrets ohne kompletten Rebootstrap.',
  up: 'Lokaler Start initialisiert Infra, Migrationen und Dev-Server.',
  update: 'Lokale Aktualisierung zieht Compose-Images neu und startet App sowie Worker kontrolliert neu.',
};

type RebuildAuditLoggerConfig = Readonly<{
  command: string;
  defaultDetails?: AuditDetails;
  gitSha?: string;
  logFile: string;
  pid?: number;
  profile?: string;
  reason: string;
  scope: RebuildAuditScope;
  targetInstanceId?: string;
}>;

type AppendRebuildAuditEvent = (logFile: string, event: RebuildAuditEvent) => void;

const toAuditErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.stack ?? error.message : String(error);

const sanitizeAuditValue = (value: unknown): AuditValue | undefined => {
  if (value === null) {
    return null;
  }

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeAuditValue(entry))
      .filter((entry): entry is AuditValue => entry !== undefined);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    const sanitizedEntries = Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => {
        const sanitizedValue = sanitizeAuditValue(entryValue);
        return sanitizedValue === undefined ? null : [key, sanitizedValue] as const;
      })
      .filter((entry): entry is readonly [string, AuditValue] => entry !== null);

    return Object.fromEntries(sanitizedEntries);
  }

  return String(value);
};

const sanitizeAuditDetails = (details?: AuditDetails): Readonly<Record<string, AuditValue>> | undefined => {
  if (!details) {
    return undefined;
  }

  const sanitized = sanitizeAuditValue(details);
  if (sanitized === undefined || sanitized === null || Array.isArray(sanitized) || typeof sanitized !== 'object') {
    return undefined;
  }

  return sanitized as Readonly<Record<string, AuditValue>>;
};

export const getRebuildAuditLogFile = (rootDir: string) => resolve(rootDir, 'artifacts/runtime/rebuild-events.jsonl');

export const appendRebuildAuditEvent = (logFile: string, event: RebuildAuditEvent): void => {
  mkdirSync(dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${JSON.stringify(event)}\n`, 'utf8');
};

export const createRebuildAuditLogger = (
  config: RebuildAuditLoggerConfig,
  appendEvent: AppendRebuildAuditEvent = appendRebuildAuditEvent,
) => {
  const writeEvent = (
    phase: string,
    status: RebuildAuditStatus,
    details?: AuditDetails,
    error?: unknown,
  ) => {
    const mergedDetails = sanitizeAuditDetails(
      config.defaultDetails || details
        ? {
            ...(config.defaultDetails ?? {}),
            ...(details ?? {}),
          }
        : undefined,
    );

    appendEvent(config.logFile, {
      at: new Date().toISOString(),
      command: config.command,
      details: mergedDetails,
      error: error === undefined ? undefined : toAuditErrorMessage(error),
      gitSha: config.gitSha,
      phase,
      pid: config.pid ?? process.pid,
      profile: config.profile,
      reason: config.reason,
      scope: config.scope,
      status,
      targetInstanceId: config.targetInstanceId,
    });
  };

  return {
    log: (phase: string, status: RebuildAuditStatus, details?: AuditDetails, error?: unknown) => {
      writeEvent(phase, status, details, error);
    },
    run: async <T>(phase: string, operation: () => Promise<T> | T, details?: AuditDetails): Promise<T> => {
      writeEvent(phase, 'started', details);
      try {
        const result = await operation();
        writeEvent(phase, 'completed', details);
        return result;
      } catch (error) {
        writeEvent(phase, 'failed', details, error);
        throw error;
      }
    },
  };
};

export const buildBootstrapLocalInstanceDbAuditDetails = (
  options: Pick<
    BootstrapLocalInstanceDbCliOptions,
    | 'createDb'
    | 'importSchema'
    | 'pageSize'
    | 'skipAppUserBootstrap'
    | 'skipCatalogSync'
    | 'skipKeycloakUserSync'
    | 'sourceDbContainer'
    | 'sourceDbName'
    | 'sourceInstanceId'
    | 'targetAppDbUser'
    | 'targetDbContainer'
    | 'targetDbName'
    | 'targetDbUser'
    | 'targetRealm'
  >,
): AuditDetails => ({
  createDb: options.createDb,
  importSchema: options.importSchema,
  pageSize: options.pageSize,
  skipAppUserBootstrap: options.skipAppUserBootstrap,
  skipCatalogSync: options.skipCatalogSync,
  skipKeycloakUserSync: options.skipKeycloakUserSync,
  sourceDbContainer: options.sourceDbContainer,
  sourceDbName: options.sourceDbName,
  sourceInstanceId: options.sourceInstanceId,
  targetAppDbUser: options.targetAppDbUser,
  targetDbContainer: options.targetDbContainer,
  targetDbName: options.targetDbName,
  targetDbUser: options.targetDbUser,
  targetRealm: options.targetRealm,
});

export const buildDeleteLocalInstanceDbAuditDetails = (
  options: Pick<
    DeleteLocalInstanceCliOptions,
    'dryRun' | 'force' | 'targetDbContainer' | 'targetDbName' | 'targetDbUser' | 'yes'
  >,
): AuditDetails => ({
  dryRun: options.dryRun,
  force: options.force,
  targetDbContainer: options.targetDbContainer,
  targetDbName: options.targetDbName,
  targetDbUser: options.targetDbUser,
  yes: options.yes,
});

export const buildLocalRuntimeAuditDetails = (input: {
  authoritative: boolean;
  composeMode: 'base' | 'with-monitoring';
  driftCheckEnabled: boolean;
  jsonOutput: boolean;
  workerEnabled: boolean;
}): AuditDetails => ({
  authoritative: input.authoritative,
  composeMode: input.composeMode,
  driftCheckEnabled: input.driftCheckEnabled,
  jsonOutput: input.jsonOutput,
  workerEnabled: input.workerEnabled,
});

export const shouldAuditLocalRuntimeCommand = (runtimeCommand: string): runtimeCommand is LocalRuntimeAuditCommand =>
  LOCAL_RUNTIME_AUDIT_COMMANDS.includes(runtimeCommand as LocalRuntimeAuditCommand);

export const resolveLocalRuntimeAuditReason = (runtimeCommand: LocalRuntimeAuditCommand): string =>
  LOCAL_RUNTIME_AUDIT_REASONS[runtimeCommand];

export const createLocalRuntimeAuditLogger = (input: {
  authoritative: boolean;
  composeMode: 'base' | 'with-monitoring';
  driftCheckEnabled: boolean;
  gitSha?: string;
  jsonOutput: boolean;
  logFile: string;
  runtimeCommand: LocalRuntimeAuditCommand;
  runtimeProfile: RuntimeProfile;
  workerEnabled: boolean;
}, appendEvent: AppendRebuildAuditEvent = appendRebuildAuditEvent) =>
  createRebuildAuditLogger({
    command: `tsx scripts/ops/runtime-env.ts ${input.runtimeCommand} ${input.runtimeProfile}`,
    defaultDetails: buildLocalRuntimeAuditDetails({
      authoritative: input.authoritative,
      composeMode: input.composeMode,
      driftCheckEnabled: input.driftCheckEnabled,
      jsonOutput: input.jsonOutput,
      workerEnabled: input.workerEnabled,
    }),
    gitSha: input.gitSha,
    logFile: input.logFile,
    profile: input.runtimeProfile,
    reason: resolveLocalRuntimeAuditReason(input.runtimeCommand),
    scope: 'local-runtime',
  }, appendEvent);
