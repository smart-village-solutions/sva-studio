import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { AcceptanceDeployReport, AcceptanceReleaseManifest } from '../runtime-env.shared.ts';
import { formatAcceptanceDeployReportMarkdown } from '../runtime-env.shared.ts';
import { getExpectedRemoteAppNetworks, type ComposeDocument } from './deploy-project.ts';
import type { AcceptanceMaintenanceDeps, BaseReportInput } from './acceptance-maintenance.types.ts';

const writeJsonArtifact = (filePath: string, payload: unknown) => {
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

export const buildAcceptanceReleaseManifest = (
  runtimeProfile: import('../runtime-env.shared.ts').RemoteRuntimeProfile,
  options: import('../runtime-env.shared.ts').AcceptanceDeployOptions,
  gitCommitSha?: string,
): AcceptanceReleaseManifest => ({
  actor: options.actor,
  commitSha: gitCommitSha,
  imageDigest: options.imageDigest,
  imageRef: options.imageRef,
  imageRepository: options.imageRepository,
  imageTag: options.imageTag,
  monitoringConfigImageTag: options.monitoringConfigImageTag,
  profile: runtimeProfile,
  releaseMode: options.releaseMode,
  workflow: options.workflow,
});

export const writeAcceptanceDeployReport = (report: AcceptanceDeployReport) => {
  writeJsonArtifact(report.artifacts.jsonPath, report);
  writeFileSync(report.artifacts.markdownPath, `${formatAcceptanceDeployReportMarkdown(report)}\n`, 'utf8');
  writeJsonArtifact(report.artifacts.releaseManifestPath, report.releaseManifest);
  writeJsonArtifact(report.artifacts.phaseReportPath, {
    bootstrapReport: report.bootstrapReport ?? { status: 'skipped' },
    failureCategory: report.failureCategory ?? null,
    generatedAt: report.generatedAt,
    migrationReport: report.migrationReport ?? { status: 'skipped' },
    releaseDecision: report.releaseDecision,
    steps: report.steps,
  });
  writeJsonArtifact(report.artifacts.bootstrapJobPath, report.bootstrapReport?.job ?? null);
  writeJsonArtifact(report.artifacts.bootstrapReportPath, report.bootstrapReport ?? { status: 'skipped' });
  writeJsonArtifact(report.artifacts.migrationJobPath, report.migrationReport?.job ?? null);
  writeJsonArtifact(report.artifacts.migrationReportPath, {
    migrationFiles: report.migrationFiles,
    migrationReport: report.migrationReport ?? { status: 'skipped' },
  });
  writeJsonArtifact(report.artifacts.internalVerifyPath, { probes: report.internalProbes, stackStatus: report.stackStatus });
  writeJsonArtifact(report.artifacts.externalSmokePath, { probes: report.externalProbes });
};

export const renderRemoteComposeDocument = (deps: AcceptanceMaintenanceDeps, env: NodeJS.ProcessEnv): ComposeDocument =>
  JSON.parse(deps.runCapture('docker', ['compose', '-f', resolve(deps.rootDir, deps.getRemoteComposeFile(env)), 'config', '--format', 'json'], env)) as ComposeDocument;

export const renderQuantumDeployProject = (deps: AcceptanceMaintenanceDeps, env: NodeJS.ProcessEnv) => {
  const runtimeProfile = env.SVA_RUNTIME_PROFILE?.trim() || 'studio';
  const renderedComposeDocument = renderRemoteComposeDocument(deps, env);
  const renderedComposeAppServiceName = 'app';
  deps.assertComposeServiceNetworks(
    renderedComposeDocument,
    renderedComposeAppServiceName,
    getExpectedRemoteAppNetworks(runtimeProfile),
  );
  deps.assertComposeServiceIngressLabels(renderedComposeDocument, renderedComposeAppServiceName);
  const renderedCompose = JSON.stringify(deps.buildQuantumDeployComposeDocument(renderedComposeDocument), null, 2);
  const projectDir = mkdtempSync(resolve(tmpdir(), `sva-studio-${runtimeProfile}-deploy-`));

  writeFileSync(resolve(projectDir, 'docker-compose.rendered.json'), `${renderedCompose}\n`, 'utf8');
  writeFileSync(
    resolve(projectDir, '.quantum'),
    ['---', 'version: "1.0"', 'compose: docker-compose.rendered.json', 'environments:', `  - name: ${runtimeProfile}`, '    compose: docker-compose.rendered.json', ''].join('\n'),
    'utf8',
  );

  return { cleanup: () => rmSync(projectDir, { force: true, recursive: true }), projectDir };
};

export const deployAcceptanceStack = (deps: AcceptanceMaintenanceDeps, env: NodeJS.ProcessEnv) => {
  const stackName = deps.getConfiguredStackName(env);

  if (deps.commandExists('quantum-cli')) {
    const renderedProject = renderQuantumDeployProject(deps, env);
    try {
      deps.run(
        'quantum-cli',
        [
          'stacks',
          'update',
          ...(env.QUANTUM_ENVIRONMENT?.trim() ? ['--environment', env.QUANTUM_ENVIRONMENT.trim()] : []),
          '--endpoint',
          deps.getConfiguredQuantumEndpoint(env),
          '--stack',
          stackName,
          '--wait',
          ...(deps.shouldSkipQuantumPrePull(env) ? ['--no-pre-pull'] : []),
          '--project',
          renderedProject.projectDir,
        ],
        deps.withoutDebugEnv(env),
      );
    } finally {
      renderedProject.cleanup();
    }
    return;
  }

  deps.run('docker', ['stack', 'deploy', '-c', deps.getRemoteComposeFile(env), stackName], env);
};

export const createBaseAcceptanceDeployReport = (
  deps: AcceptanceMaintenanceDeps,
  { env, gitCommitSha, migrationFiles, options, runtimeProfile }: BaseReportInput,
) => {
  const generatedAt = new Date().toISOString();
  const reportPaths = deps.buildLocalRuntimeDeployReportPaths(deps.deployReportDir, options.reportSlug, generatedAt);
  return {
    actor: options.actor,
    artifacts: {
      bootstrapJobPath: reportPaths.bootstrapJobPath,
      bootstrapReportPath: reportPaths.bootstrapReportPath,
      externalSmokePath: reportPaths.externalSmokePath,
      internalVerifyPath: reportPaths.internalVerifyPath,
      jsonPath: reportPaths.jsonPath,
      markdownPath: reportPaths.markdownPath,
      migrationJobPath: reportPaths.migrationJobPath,
      migrationReportPath: reportPaths.migrationReportPath,
      phaseReportPath: reportPaths.phaseReportPath,
      releaseManifestPath: reportPaths.releaseManifestPath,
    },
    externalProbes: [],
    generatedAt,
    imageDigest: options.imageDigest,
    imageRef: options.imageRef,
    imageRepository: options.imageRepository,
    imageTag: options.imageTag,
    internalProbes: [],
    maintenanceWindow: options.maintenanceWindow,
    migrationFiles,
    observability: {
      grafanaUrl: options.grafanaUrl,
      lokiUrl: options.lokiUrl,
      notes: ['Logs und Metriken bleiben intern; die Referenzen sind fuer Incident- und Release-Evidenz gedacht.'],
    },
    profile: runtimeProfile,
    releaseDecision: { summary: 'Technische Freigabe noch nicht entschieden.', technicalGatePassed: false },
    releaseManifest: buildAcceptanceReleaseManifest(runtimeProfile, options, gitCommitSha),
    releaseMode: options.releaseMode,
    reportId: reportPaths.reportId,
    rollbackHint: options.rollbackHint,
    runtimeContract: {
      derivedKeys: deps.getRuntimeProfileDerivedEnvKeys(runtimeProfile),
      effectiveSummary: deps.getRuntimeContractSummary(runtimeProfile, env),
      requiredKeys: deps.getRuntimeProfileRequiredEnvKeys(runtimeProfile),
    },
    stackName: deps.getConfiguredStackName(env),
    status: 'ok' as const,
    steps: [],
    workflow: options.workflow,
  };
};
