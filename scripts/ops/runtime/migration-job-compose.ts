import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { MigrationJobDeps } from './migration-job.ts';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type ComposeDocument = {
  name?: string;
  networks?: Record<string, JsonValue>;
  secrets?: Record<string, JsonValue>;
  services?: Record<string, JsonValue>;
  version?: string;
  volumes?: Record<string, JsonValue>;
};

type RemoteComposeInput =
  | { remoteComposeFile: string; remoteComposeFiles?: never }
  | { remoteComposeFile?: never; remoteComposeFiles: readonly [string, ...string[]] };

export type RunMigrationJobInput = RemoteComposeInput & {
  internalNetworkName: string;
  jobServiceName?: 'candidate' | 'migrate';
  quantumEndpoint: string;
  reportId: string;
  runtimeProfile: string;
  sourceStackName: string;
};

const normalizeQuantumComposeValue = (value: JsonValue, parentKey?: string): JsonValue => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeQuantumComposeValue(entry, parentKey))
      .filter((entry): entry is Exclude<JsonValue, null> => entry !== null);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const record = value as Record<string, JsonValue>;
  const preserveNullEntries = parentKey === 'networks';
  const normalizedEntries = Object.entries(record)
    .filter(([, entry]) => preserveNullEntries || entry !== null)
    .map(([key, entry]) => {
      if (key === 'cpus' && typeof entry === 'number') {
        return [key, String(entry)] as const;
      }
      return [key, normalizeQuantumComposeValue(entry, key)] as const;
    })
    .filter(([, entry]) => preserveNullEntries || entry !== null);

  return Object.fromEntries(normalizedEntries) as JsonValue;
};

const toTemporaryJobStackName = (
  sourceStackName: string,
  serviceName: string,
  reportId: string
) => {
  const sanitizedReportId = reportId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 32);
  return `${sourceStackName}-${serviceName}-${sanitizedReportId || 'job'}`;
};

export const buildMigrationJobComposeDocument = (
  renderedCompose: ComposeDocument,
  input: {
    internalNetworkName: string;
    jobStackName: string;
    sourceStackName: string;
    targetReplicas: number;
    jobServiceName?: 'candidate' | 'migrate';
  }
): ComposeDocument => {
  const composeWithoutName = { ...renderedCompose };
  delete composeWithoutName.name;
  const jobServiceName = input.jobServiceName ?? 'migrate';
  const jobService = renderedCompose.services?.[jobServiceName];
  if (!jobService || typeof jobService !== 'object' || Array.isArray(jobService)) {
    throw new Error(`Render-Compose enthaelt keinen dedizierten ${jobServiceName}-Service.`);
  }

  return normalizeQuantumComposeValue({
    version: composeWithoutName.version ?? '3.8',
    services: {
      [jobServiceName]: {
        ...(jobService as Record<string, JsonValue>),
        networks: ['internal'],
        deploy: {
          ...(((jobService as Record<string, JsonValue>).deploy as
            Record<string, JsonValue> | undefined) ?? {}),
          replicas: input.targetReplicas,
          restart_policy: {
            condition: 'none',
          },
        },
        environment: {
          ...(((jobService as Record<string, JsonValue>).environment as
            Record<string, JsonValue> | undefined) ?? {}),
          POSTGRES_HOST: `${input.sourceStackName}_postgres`,
          ...(jobServiceName === 'migrate'
            ? {
                SVA_MIGRATION_JOB_STACK: input.jobStackName,
                SVA_MIGRATION_TARGET_STACK: input.sourceStackName,
              }
            : {}),
        },
      },
    },
    networks: {
      internal: {
        external: true,
        name: input.internalNetworkName,
      },
    },
    ...(composeWithoutName.secrets ? { secrets: composeWithoutName.secrets } : {}),
  }) as ComposeDocument;
};

export const createQuantumProject = (
  deps: Pick<MigrationJobDeps, 'rootDir' | 'runCapture' | 'runCaptureDetailed'>,
  env: NodeJS.ProcessEnv,
  input: RunMigrationJobInput
) => {
  const jobServiceName = input.jobServiceName ?? 'migrate';
  const jobStackName = toTemporaryJobStackName(
    input.sourceStackName,
    jobServiceName,
    input.reportId
  );
  const remoteComposeFiles = input.remoteComposeFiles ?? [input.remoteComposeFile];
  const renderedComposeDocument = JSON.parse(
    deps.runCapture(
      deps.rootDir,
      'docker',
      [
        'compose',
        ...remoteComposeFiles.flatMap((filePath) => ['-f', resolve(deps.rootDir, filePath)]),
        'config',
        '--format',
        'json',
      ],
      {
        ...env,
        ...(jobServiceName === 'migrate' ? { SVA_MIGRATE_REPLICAS: '1' } : {}),
        SVA_MIGRATION_JOB_STACK: jobStackName,
        SVA_MIGRATION_TARGET_STACK: input.sourceStackName,
        SVA_STACK_NAME: input.sourceStackName,
      }
    )
  ) as ComposeDocument;
  const jobCompose = buildMigrationJobComposeDocument(renderedComposeDocument, {
    internalNetworkName: input.internalNetworkName,
    jobStackName,
    sourceStackName: input.sourceStackName,
    targetReplicas: 1,
    jobServiceName,
  });
  const renderedComposeJson = JSON.stringify(jobCompose, null, 2);
  const projectDir = mkdtempSync(
    resolve(tmpdir(), `sva-studio-${input.runtimeProfile}-${jobServiceName}-`)
  );
  const renderedComposePath = resolve(projectDir, 'docker-compose.rendered.json');

  writeFileSync(renderedComposePath, `${renderedComposeJson}\n`, 'utf8');

  return {
    jobStackName,
    projectDir,
    renderedComposePath,
    cleanup: () => {
      rmSync(projectDir, { force: true, recursive: true });
    },
  };
};

export const buildQuantumDeployArgs = (
  endpoint: string,
  stackName: string,
  composePath: string
) => ['stacks', 'deploy', '-f', composePath, '--stack', stackName, '--endpoint', endpoint];
