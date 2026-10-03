import {
  adminPassword,
  assert,
  database,
  instanceId,
  jobTypeId,
  pluginId,
  queueName,
  workerPassword,
} from './plugin-lifecycle-contract-base.js';
import type { ContractPool, QueryClient } from './plugin-lifecycle-contract-base.js';

let handlerAttempts = 0;
let handlerEffectDatabase: QueryClient | undefined;
export const setHandlerEffectDatabase = (pool: QueryClient): void => {
  handlerEffectDatabase = pool;
};
export const getHandlerAttempts = (): number => handlerAttempts;

export type RuntimeModules = {
  readonly start: (input: {
    instanceId: string;
    pluginId: string;
    operation: 'provision' | 'reconcile';
    scheduledAt: string;
  }) => Promise<{ lifecycle: { desiredGeneration: number }; job: { id: string } }>;
  readonly ensure: (instanceId: string) => Promise<void>;
  readonly createTaskList: (
    getRegistry: () => ReadonlyMap<string, unknown>,
    taskIdentifier?: string
  ) => Record<string, (payload: unknown, helpers: unknown) => Promise<void>>;
  readonly registry: () => ReadonlyMap<string, unknown>;
  readonly configure: (input: {
    activationPolicies: {
      revision: string;
      modules: readonly {
        moduleId: string;
        activationPolicy: 'automatic';
        manifestVersion: number;
        policyRevision: string;
      }[];
    };
    moduleIamContracts: readonly [];
    pluginOidcClientRequirements: readonly [];
    tenantLifecycles: readonly {
      pluginId: string;
      contractVersion: 1;
      operations: readonly {
        operation: 'provision' | 'reconcile';
        jobTypeId: string;
      }[];
      readinessChecks: readonly {
        checkId: string;
        titleKey: string;
        required: boolean;
      }[];
    }[];
  }) => void;
  readonly register: (handlers: Readonly<Record<string, unknown>>) => void;
  readonly close: () => Promise<void>;
};

export const loadRuntime = async (port: string): Promise<RuntimeModules> => {
  process.env.IAM_DATABASE_URL = `postgres://postgres:${adminPassword}@127.0.0.1:${port}/${database}`;
  process.env.STUDIO_JOB_WORKER_DATABASE_URL = `postgres://sva_job_worker:${workerPassword}@127.0.0.1:${port}/${database}`;
  const [runtime, runner, snapshot, databaseRuntime, jobRepository, registryRepository] =
    await Promise.all([
      import('../../packages/auth-runtime/src/plugin-tenant-lifecycle/runtime.js'),
      import('../../packages/auth-runtime/src/plugin-operations/runner-registry.js'),
      import('../../packages/auth-runtime/src/iam-instance-registry/plugin-activation-policy-snapshot.js'),
      import('../../packages/auth-runtime/src/db.js'),
      import('../../packages/auth-runtime/src/plugin-operations/repository.js'),
      import('../../packages/auth-runtime/src/iam-instance-registry/repository.js'),
    ]);
  return {
    start: runtime.startConfiguredPluginTenantLifecycle,
    ensure: runtime.ensureConfiguredPluginTenantProvisioning,
    createTaskList: runner.createStudioJobTaskList as RuntimeModules['createTaskList'],
    registry: runner.getRegisteredStudioJobExecutionRegistry as RuntimeModules['registry'],
    configure: snapshot.configureInstanceRegistryPluginRuntimeSnapshot,
    register: runner.registerPluginOperationExecutionHandlers as RuntimeModules['register'],
    close: async () => {
      await Promise.all([
        databaseRuntime.resolvePool()?.end(),
        jobRepository.closeStudioJobRepositoryPoolForShutdown(),
        registryRepository.closeInstanceRegistryRepositoryPoolForShutdown(),
      ]);
    },
  };
};

export const configureRuntime = (
  runtime: RuntimeModules,
  contractRevision: 'contract-1' | 'contract-2' = 'contract-1',
  behavior:
    | 'ready'
    | 'pending'
    | 'invalid'
    | 'malformed'
    | 'retry-once'
    | 'always-fail'
    | 'idempotent-effect' = 'ready',
  executionLane: 'default' | 'privileged' = 'default',
  registeredQueueName = queueName
): void => {
  handlerAttempts = 0;
  runtime.configure({
    activationPolicies: {
      revision: contractRevision,
      modules: [
        {
          moduleId: pluginId,
          activationPolicy: 'automatic',
          manifestVersion: contractRevision === 'contract-1' ? 1 : 2,
          policyRevision: contractRevision,
        },
      ],
    },
    moduleIamContracts: [],
    pluginOidcClientRequirements: [],
    tenantLifecycles: [
      {
        pluginId,
        contractVersion: 1,
        operations: [
          { operation: 'provision', jobTypeId },
          { operation: 'reconcile', jobTypeId },
        ],
        readinessChecks: [
          { checkId: `${pluginId}.database`, titleKey: 'contract', required: true },
        ],
      },
    ],
  });
  runtime.register({
    [jobTypeId]: {
      queueName: registeredQueueName,
      executionLane,
      handler: async () => {
        handlerAttempts += 1;
        if (behavior === 'invalid') return {};
        if (behavior === 'malformed') {
          return { tenantLifecycle: { revision: '', checks: [] } };
        }
        if (behavior === 'idempotent-effect') {
          assert(handlerEffectDatabase, 'handler_effect_database_missing');
          await handlerEffectDatabase.query(
            `INSERT INTO lifecycle_contract.effects(effect_key) VALUES ($1)
             ON CONFLICT (effect_key) DO UPDATE
             SET deliveries = lifecycle_contract.effects.deliveries + 1`,
            [`${instanceId}:${pluginId}`]
          );
        }
        if (behavior === 'always-fail' || (behavior === 'retry-once' && handlerAttempts === 1)) {
          throw new Error(`lifecycle-contract-${behavior}`);
        }
        return {
          tenantLifecycle: {
            revision: 'database-1',
            checks: [
              {
                checkId: `${pluginId}.database`,
                status: behavior === 'pending' ? 'pending' : 'ready',
              },
            ],
          },
        };
      },
    },
  });
};

export type MatrixContext = {
  readonly adminPool: ContractPool;
  readonly workerPool: ContractPool;
  readonly runtime: RuntimeModules;
  readonly port: string;
};
