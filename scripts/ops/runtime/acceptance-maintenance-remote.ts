import { shellEscape } from './runtime-config.ts';
import type { AcceptanceMaintenanceDeps } from './acceptance-maintenance.types.ts';
import { resolveAcceptanceContainerServices, resolveRemoteShortServiceName, resolveRemoteStackServiceName } from './runtime-health-helpers.ts';

export const buildSwarmServicePresenceProbe = (deps: AcceptanceMaintenanceDeps, env: NodeJS.ProcessEnv) => {
  const stackName = deps.getConfiguredStackName(env);
  const requiredServices = resolveAcceptanceContainerServices(env, resolveRemoteShortServiceName(stackName, deps.getRemoteAppServiceName(env)));

  return {
    durationMs: 0,
    details: { requiredServices },
    message: 'Swarm-Service-Praesenz wird im Acceptance-Deploy-Report separat erfasst.',
    name: 'swarm-services',
    scope: 'internal' as const,
    status: 'ok' as const,
    target: deps.getConfiguredStackName(env),
  };
};

export const resolveRemoteInternalNetworkName = async (deps: AcceptanceMaintenanceDeps, env: NodeJS.ProcessEnv) => {
  const stackName = deps.getConfiguredStackName(env);
  const postgresServiceName = resolveRemoteShortServiceName(stackName, env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres');
  const postgresContract = await deps.inspectRemoteServiceContract(env, {
    quantumEndpoint: deps.getConfiguredQuantumEndpoint(env),
    serviceName: postgresServiceName,
    stackName,
  });
  const postgresNetworkName = (postgresContract?.networkNames ?? [])
    .find((networkName) => networkName !== 'public')
    ?.trim();
  if (postgresNetworkName) {
    return postgresNetworkName;
  }

  const appServiceName = resolveRemoteShortServiceName(stackName, deps.getRemoteAppServiceName(env));
  const liveContract = await deps.inspectRemoteServiceContract(env, {
    quantumEndpoint: deps.getConfiguredQuantumEndpoint(env),
    serviceName: appServiceName,
    stackName,
  });
  const internalNetworkName = (liveContract?.networkNames ?? []).find((networkName) => networkName !== 'public')?.trim();
  if (internalNetworkName) {
    return internalNetworkName;
  }

  throw new Error(
    `Internes Overlay-Netz fuer ${resolveRemoteStackServiceName(stackName, appServiceName)} konnte nicht aus der Live-Service-Spec abgeleitet werden.`,
  );
};

export const runAcceptanceServiceScript = (
  deps: AcceptanceMaintenanceDeps,
  env: NodeJS.ProcessEnv,
  service: string,
  script: string,
  options: { failureMessage: string; marker?: string; slot?: string },
) => {
  if (!deps.commandExists('quantum-cli')) {
    throw new Error('quantum-cli ist fuer Remote-Operationen nicht verfuegbar.');
  }

  return deps.runQuantumExec(
    [
      'exec',
      '--endpoint',
      deps.getConfiguredQuantumEndpoint(env),
      '--stack',
      deps.getConfiguredStackName(env),
      '--service',
      service,
      '--slot',
      options.slot ?? '1',
      '-c',
      `sh -lc ${shellEscape(script)}`,
    ],
    env,
    options,
  );
};

export const runAcceptanceSqlAgainstDatabase = (
  deps: AcceptanceMaintenanceDeps,
  env: NodeJS.ProcessEnv,
  sql: string,
  database: string,
  failureMessage: string,
) => {
  const marker = '__SVA_RESET_STATUS__';
  const postgresUser = env.POSTGRES_USER ?? 'sva';
  const remoteScript = [
    'set -euo pipefail',
    "cat <<'SQL' >/tmp/sva-runtime-reset.sql",
    sql,
    'SQL',
    'status=0',
    `psql -X -P pager=off -q -v ON_ERROR_STOP=1 -U ${shellEscape(postgresUser)} -d ${shellEscape(database)} -f /tmp/sva-runtime-reset.sql >/tmp/sva-runtime-reset.log 2>&1 || status=$?`,
    `printf '%s\\n' '${marker}_START'`,
    "if [ -f /tmp/sva-runtime-reset.log ]; then cat /tmp/sva-runtime-reset.log; fi",
    "printf 'sql_exit:%s\\n' \"$status\"",
    `printf '%s\\n' '${marker}_END'`,
    'rm -f /tmp/sva-runtime-reset.sql /tmp/sva-runtime-reset.log',
    'if [ "$status" -ne 0 ]; then exit "$status"; fi',
    'sleep 1',
  ].join('\n');

  return runAcceptanceServiceScript(deps, env, env.SVA_ACCEPTANCE_POSTGRES_SERVICE ?? 'postgres', remoteScript, {
    failureMessage,
    marker,
    slot: env.SVA_ACCEPTANCE_POSTGRES_SLOT ?? '1',
  });
};

export const migrateAcceptance = async (
  deps: AcceptanceMaintenanceDeps,
  runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
) => {
  if (deps.listGooseMigrationFiles().length === 0) {
    throw new Error('Keine Goose-Migrationen unter packages/data/migrations gefunden.');
  }

  const migrationResult = await deps.runMigrationJobAgainstAcceptance(env, runtimeProfile, `manual-${Date.now()}`);
  try {
    console.log(`Swarm-Migrationsjob fuer ${runtimeProfile}: ${migrationResult.jobStackName}/${migrationResult.jobServiceName}`);
    if (migrationResult.logTail) {
      console.log(migrationResult.logTail);
    }
  } finally {
    await migrationResult.cleanup();
  }

  const bootstrapResult = await deps.runBootstrapJobAgainstAcceptance(env, runtimeProfile, `manual-${Date.now()}`);
  try {
    console.log(`Swarm-Bootstrap-Job fuer ${runtimeProfile}: ${bootstrapResult.jobStackName}/${bootstrapResult.jobServiceName}`);
    if (bootstrapResult.logTail) {
      console.log(bootstrapResult.logTail);
    }
  } finally {
    await bootstrapResult.cleanup();
  }
};

export const resetAcceptance = async (
  deps: AcceptanceMaintenanceDeps,
  runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile,
  env: NodeJS.ProcessEnv,
  verifyPostReset: () => Promise<void>,
) => {
  runAcceptanceSqlAgainstDatabase(deps, env, 'DROP SCHEMA IF EXISTS iam CASCADE;', env.POSTGRES_DB ?? 'sva_studio', 'Acceptance-Postgres-Schema-Reset fehlgeschlagen.');
  const redisPassword = env.REDIS_PASSWORD?.trim();
  if (!redisPassword) {
    throw new Error('REDIS_PASSWORD fehlt fuer den Acceptance-Reset.');
  }

  runAcceptanceServiceScript(
    deps,
    env,
    'redis',
    ['set -euo pipefail', `redis-cli --no-auth-warning -a ${shellEscape(redisPassword)} FLUSHALL >/dev/null`, "printf '%s\\n' '__SVA_REDIS_RESET___START'", "printf '%s\\n' 'ok'", "printf '%s\\n' '__SVA_REDIS_RESET___END'", 'sleep 1'].join('\n'),
    { failureMessage: 'Acceptance-Redis-Reset fehlgeschlagen.', marker: '__SVA_REDIS_RESET__' },
  );

  await migrateAcceptance(deps, runtimeProfile, env);
  await verifyPostReset();
};

export const captureAcceptanceStackStatus = async (deps: AcceptanceMaintenanceDeps, env: NodeJS.ProcessEnv) => {
  const stackName = deps.getConfiguredStackName(env);

  try {
    try {
      const evidence = await deps.readRemoteStackEvidence(env);
      return { services: evidence.services ?? evidence.summary, tasks: evidence.tasks ?? evidence.summary };
    } catch {
      // fall through
    }

    if (deps.commandExists('quantum-cli')) {
      try {
        const services = deps.runCapture('quantum-cli', ['ps', '--endpoint', deps.getConfiguredQuantumEndpoint(env), '--stack', stackName, '--all'], deps.withoutDebugEnv(env));
        return { services, tasks: services };
      } catch {
        // fall back to docker
      }
    }

    return {
      services: deps.runCaptureDetailed('docker', ['stack', 'services', stackName], env).stdout.trim(),
      tasks: deps.runCaptureDetailed('docker', ['stack', 'ps', stackName], env).stdout.trim(),
    };
  } catch (error) {
    return {
      services: `Stack-Status konnte nicht erfasst werden: ${error instanceof Error ? error.message : String(error)}`,
      tasks: '',
    };
  }
};
