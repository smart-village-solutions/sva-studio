import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AuditCheckResult, AuditInstanceResult, AuditRegistryTarget, StudioInstanceAuditResult } from './model.ts';
import { aggregateAuditStatus } from './model.ts';
import { parseStudioInstanceAuditOptions } from './options.ts';
import { createStudioRemoteSqlClient } from './remote-sql.ts';
import { assertStudioAuditRuntime, withStudioAuditEnv } from './runtime.ts';
import { loadAuditTargets } from './registry.ts';
import { runHttpChecks } from './http-checks.ts';
import { inspectTenantSecrets } from './secrets.ts';
import { inspectRealmAndClients } from './keycloak.ts';
import { inspectLocalStudioIam } from './local-iam.ts';
import { renderStudioInstanceAuditHtml } from './render-html.ts';
import { writeStudioInstanceAuditReport } from './write-report.ts';

const buildRegistryChecks = (target: AuditRegistryTarget): readonly AuditCheckResult[] => [
  {
    checkId: 'registry.instance.active',
    status: target.status === 'active' ? 'pass' : 'fail',
    summary: target.status,
    title: 'Registry-Status ist betriebsrelevant',
  },
  {
    checkId: 'registry.fields.present',
    status:
      target.instanceId
      && target.primaryHostname
      && target.parentDomain
      && target.authRealm
      && target.authClientId
      && target.tenantAdminClientId
        ? 'pass'
        : 'fail',
    summary: `${target.instanceId} -> ${target.primaryHostname}`,
    title: 'Registry-Felder sind gesetzt',
  },
  {
    checkId: 'registry.secrets.configured',
    details: {
      authClientSecretConfigured: target.authClientSecretConfigured,
      tenantAdminClientSecretConfigured: target.tenantAdminClientSecretConfigured,
    },
    status: target.authClientSecretConfigured && target.tenantAdminClientSecretConfigured ? 'pass' : 'fail',
    summary: `${target.authClientSecretConfigured ? 'login' : 'login-missing'} / ${target.tenantAdminClientSecretConfigured ? 'tenant-admin' : 'tenant-admin-missing'}`,
    title: 'Registry markiert beide Client-Secrets als konfiguriert',
  },
];

const toFailureCheck = (checkId: string, title: string, error: unknown): AuditCheckResult => ({
  checkId,
  details: error instanceof Error ? { message: error.message } : { message: String(error) },
  status: 'fail',
  summary: error instanceof Error ? error.message : String(error),
  title,
});

const buildInstanceResult = async (
  sqlClient: ReturnType<typeof createStudioRemoteSqlClient>,
  target: AuditRegistryTarget,
): Promise<AuditInstanceResult> => {
  const checks: AuditCheckResult[] = [...buildRegistryChecks(target)];

  try {
    const httpResult = await runHttpChecks(target);
    checks.push(...httpResult.checks);
  } catch (error) {
    checks.push(toFailureCheck('http.inspect', 'HTTP-Erreichbarkeit wurde geprüft', error));
  }

  let secretResult: Awaited<ReturnType<typeof inspectTenantSecrets>> = { checks: [] };
  try {
    secretResult = await inspectTenantSecrets(sqlClient, target.instanceId);
    checks.push(...secretResult.checks);
  } catch (error) {
    checks.push(toFailureCheck('secrets.inspect', 'Tenant-Secrets wurden gelesen', error));
  }

  try {
    const keycloakResult = await inspectRealmAndClients(target, {
      authSecret: secretResult.authSecret,
      tenantAdminSecret: secretResult.adminSecret,
    });
    checks.push(...keycloakResult.checks);
  } catch (error) {
    checks.push(toFailureCheck('keycloak.inspect', 'Keycloak-Konfiguration wurde geprüft', error));
  }

  try {
    const localIamResult = await inspectLocalStudioIam(sqlClient, target.instanceId);
    checks.push(...localIamResult.checks);
  } catch (error) {
    checks.push(toFailureCheck('local_iam.inspect', 'Lokale IAM-Daten wurden geprüft', error));
  }

  return {
    authClientId: target.authClientId,
    authRealm: target.authRealm,
    checks,
    instanceId: target.instanceId,
    parentDomain: target.parentDomain,
    primaryHostname: target.primaryHostname,
    registryStatus: target.status,
    status: aggregateAuditStatus(checks.map((check) => check.status)),
  };
};

export const executeStudioInstanceAudit = async (
  argv: readonly string[],
): Promise<{ outputPath: string; result: StudioInstanceAuditResult }> => {
  const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const runtime = assertStudioAuditRuntime({
    commandExists: (name) => {
      try {
        return Boolean(process.env.PATH) && spawnSync('bash', ['-lc', `command -v ${name}`], { stdio: 'ignore' }).status === 0;
      } catch {
        return false;
      }
    },
    env: process.env,
    rootDir,
  });

  return withStudioAuditEnv(runtime.env, async () => {
    const options = parseStudioInstanceAuditOptions(argv, runtime.rootDir);
    const sqlClient = createStudioRemoteSqlClient(runtime);
    const targets = await loadAuditTargets(sqlClient);
    if (targets.length === 0) {
      throw new Error(
        'Das Instanz-Audit hat 0 aktive Registry-Targets geladen. Das ist für das studio-Profil unplausibel und deutet auf einen fehlerhaften Remote-SQL-Transport hin.'
      );
    }
    const instances = await Promise.all(targets.map((target) => buildInstanceResult(sqlClient, target)));
    const result: StudioInstanceAuditResult = {
      generatedAt: new Date().toISOString(),
      instances,
      profile: runtime.profile,
      status: aggregateAuditStatus(instances.map((instance) => instance.status)),
    };
    const html = renderStudioInstanceAuditHtml(result);
    const outputPath = writeStudioInstanceAuditReport(options.outputDir, html);
    return { outputPath, result };
  });
};
