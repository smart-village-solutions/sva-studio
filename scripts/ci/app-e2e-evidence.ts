import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type AppE2EEvidence = Readonly<{
  schemaVersion: 1;
  workflow: 'App E2E';
  event: 'push' | 'schedule' | 'workflow_dispatch';
  ref: string;
  branch: string;
  headSha: string;
  run: Readonly<{ id: string; attempt: number }>;
  result: 'success' | 'failure' | 'cancelled';
  failureClass: 'none' | 'test' | 'infrastructure-setup' | 'cancelled';
  evidenceClass: 'canonical-main' | 'diagnostic';
  subject: Readonly<{
    kind: 'local-app-service-stack';
    app: 'sva-studio-react';
    services: readonly ['redis', 'loki', 'otel-collector', 'promtail'];
    containerArtifactVerified: false;
  }>;
  rerunPolicy: Readonly<{
    automaticSuccessRetry: false;
    allowed: 'manual-infrastructure-only';
  }>;
}>;

const shaPattern = /^[0-9a-f]{40}$/u;
const refPattern = /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;
const branchPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;

export const buildAppE2EEvidence = (input: {
  workflow: string;
  event: string;
  ref: string;
  branch: string;
  headSha: string;
  runId: string;
  runAttempt: number;
  result: string;
  testOutcome: string;
}): AppE2EEvidence => {
  if (input.workflow !== 'App E2E') throw new Error('Ungültiger E2E-Workflow.');
  if (!['push', 'schedule', 'workflow_dispatch'].includes(input.event))
    throw new Error('Ungültiges E2E-Event.');
  if (!refPattern.test(input.ref) || input.ref.includes('..')) throw new Error('Ungültiger Ref.');
  if (!branchPattern.test(input.branch) || input.branch.includes('..'))
    throw new Error('Ungültiger Branch.');
  if (!shaPattern.test(input.headSha)) throw new Error('Ungültiges Head-SHA.');
  if (!/^\d+$/u.test(input.runId)) throw new Error('Ungültige Run-ID.');
  if (!Number.isSafeInteger(input.runAttempt) || input.runAttempt < 1)
    throw new Error('Ungültiger Run-Attempt.');
  if (!['success', 'failure', 'cancelled'].includes(input.result))
    throw new Error('Ungültiges Ergebnis.');
  if (!['success', 'failure', 'cancelled', 'skipped', ''].includes(input.testOutcome))
    throw new Error('Ungültiges Testergebnis.');

  const canonicalMain =
    input.event === 'push' && input.ref === 'refs/heads/main' && input.branch === 'main';
  const failureClass =
    input.result === 'success'
      ? 'none'
      : input.result === 'cancelled'
        ? 'cancelled'
        : input.testOutcome === 'failure'
          ? 'test'
          : 'infrastructure-setup';
  return {
    schemaVersion: 1,
    workflow: 'App E2E',
    event: input.event as AppE2EEvidence['event'],
    ref: input.ref,
    branch: input.branch,
    headSha: input.headSha,
    run: { id: input.runId, attempt: input.runAttempt },
    result: input.result as AppE2EEvidence['result'],
    failureClass,
    evidenceClass: canonicalMain ? 'canonical-main' : 'diagnostic',
    subject: {
      kind: 'local-app-service-stack',
      app: 'sva-studio-react',
      services: ['redis', 'loki', 'otel-collector', 'promtail'],
      containerArtifactVerified: false,
    },
    rerunPolicy: { automaticSuccessRetry: false, allowed: 'manual-infrastructure-only' },
  };
};

export const writeAppE2EEvidenceFromEnvironment = (
  env: NodeJS.ProcessEnv = process.env
): string => {
  const evidence = buildAppE2EEvidence({
    workflow: env.GITHUB_WORKFLOW ?? '',
    event: env.GITHUB_EVENT_NAME ?? '',
    ref: env.GITHUB_REF ?? '',
    branch: env.GITHUB_REF_NAME ?? '',
    headSha: env.GITHUB_SHA ?? '',
    runId: env.GITHUB_RUN_ID ?? '',
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT),
    result: env.APP_E2E_RESULT ?? '',
    testOutcome: env.APP_E2E_TEST_OUTCOME ?? '',
  });
  const runnerTemp = env.RUNNER_TEMP;
  if (!runnerTemp) throw new Error('RUNNER_TEMP fehlt.');
  const outputPath = resolve(
    runnerTemp,
    `app-e2e-evidence-${evidence.run.id}-${evidence.run.attempt}.json`
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      env.GITHUB_STEP_SUMMARY,
      `## App E2E\n\n- Ergebnis: ${evidence.result}\n- Fehlerklasse: ${evidence.failureClass}\n- Evidenzklasse: ${evidence.evidenceClass}\n- Head-SHA: ${evidence.headSha}\n- Prüfgegenstand: lokaler App-/Service-Stack (kein Container-Artefakt verifiziert)\n- Run/Attempt: ${evidence.run.id}/${evidence.run.attempt}\n`,
      'utf8'
    );
  }
  return outputPath;
};
