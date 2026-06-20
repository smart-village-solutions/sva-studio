import type { RuntimeProfile } from '../../../packages/core/src/runtime-profile.ts';
import {
  buildLocalInstanceRegistryIdentitySelectSql,
  buildLocalInstanceRegistryReconciliationInput,
  buildLocalInstanceRegistryReconciliationSql,
  evaluateLocalInstanceRegistryIdentityDrift,
  type LocalInstanceRegistryIdentityRow,
} from './local-instance-registry.ts';

type RuntimeLocalInstanceOpsDeps = {
  createDbSqlRunner: (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => (sql: string) => string;
  parseJsonFromCommandOutput: <T>(value: string) => T;
  run: (command: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;
};

export const createRuntimeLocalInstanceOps = (deps: RuntimeLocalInstanceOpsDeps) => {
  const checkLocalInstanceRegistryDrift = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    const input = buildLocalInstanceRegistryReconciliationInput(env);
    if (!input) {
      return;
    }

    const rows = deps.parseJsonFromCommandOutput<LocalInstanceRegistryIdentityRow[]>(
      deps.createDbSqlRunner(runtimeProfile, env)(buildLocalInstanceRegistryIdentitySelectSql(input)),
    );
    const drift = evaluateLocalInstanceRegistryIdentityDrift(input, rows);
    if (drift.length === 0) {
      return;
    }

    const summary = drift.map((item) => `${item.id} [${item.fields.join(', ')}]`).join(', ');
    const message =
      `Lokale Registry-Identitaet driftet fuer bestehende Instanzen vom Zielbild ab: ${summary}. ` +
      'Standardpfad bleibt non-destructive; fuer autoritative Korrekturen SVA_LOCAL_INSTANCE_IDENTITY_RECONCILE_MODE=authoritative verwenden.';
    if (input.driftMode === 'fail') {
      throw new Error(message);
    }
    process.stderr.write(`${message}\n`);
  };

  const requireLocalInstanceRegistryReconciliationInput = (env: NodeJS.ProcessEnv) => {
    const input = buildLocalInstanceRegistryReconciliationInput(env);
    if (input) {
      return input;
    }

    throw new Error('Lokaler Instanz-Registry-Abgleich erfordert SVA_PARENT_DOMAIN und SVA_ALLOWED_INSTANCE_IDS.');
  };

  const reconcileLocalInstanceRegistry = (
    runtimeProfile: RuntimeProfile,
    env: NodeJS.ProcessEnv,
    options?: {
      authoritative?: boolean;
    },
  ) => {
    const effectiveEnv =
      options?.authoritative ? { ...env, SVA_LOCAL_INSTANCE_IDENTITY_RECONCILE_MODE: 'authoritative' } : env;
    const input = requireLocalInstanceRegistryReconciliationInput(effectiveEnv);
    const sql = buildLocalInstanceRegistryReconciliationSql(input);
    deps.createDbSqlRunner(runtimeProfile, effectiveEnv)(sql);
  };

  const collectLocalInstanceIdentityDrift = (runtimeProfile: RuntimeProfile, env: NodeJS.ProcessEnv) => {
    const input = buildLocalInstanceRegistryReconciliationInput(env);
    if (!input) {
      return [] as ReturnType<typeof evaluateLocalInstanceRegistryIdentityDrift>;
    }

    const rows = deps.parseJsonFromCommandOutput<LocalInstanceRegistryIdentityRow[]>(
      deps.createDbSqlRunner(runtimeProfile, env)(buildLocalInstanceRegistryIdentitySelectSql(input)),
    );
    return evaluateLocalInstanceRegistryIdentityDrift(input, rows);
  };

  const repairActorBindingFromEnv = async (env: NodeJS.ProcessEnv): Promise<void> => {
    const templateSubject = env.SVA_DOCTOR_BIND_COPY_FROM_KEYCLOAK_SUBJECT?.trim();
    const instanceId = env.SVA_DOCTOR_INSTANCE_ID?.trim();
    const keycloakSubject = env.SVA_DOCTOR_KEYCLOAK_SUBJECT?.trim();

    if (!templateSubject || !instanceId || !keycloakSubject) {
      return;
    }

    deps.run(
      'pnpm',
      [
        'env:bind:local-user',
        '--',
        `--instance-id=${instanceId}`,
        `--keycloak-subject=${keycloakSubject}`,
        `--copy-from-keycloak-subject=${templateSubject}`,
      ],
      env,
    );
  };

  return {
    buildLocalInstanceRegistryReconciliationInput,
    checkLocalInstanceRegistryDrift,
    collectLocalInstanceIdentityDrift,
    reconcileLocalInstanceRegistry,
    repairActorBindingFromEnv,
    requireLocalInstanceRegistryReconciliationInput,
  };
};
