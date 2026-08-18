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
  testOutcome: 'success' | 'failure' | 'cancelled' | 'not-run';
  evidenceClass: 'canonical-main' | 'diagnostic';
  subject: Readonly<{
    kind: 'local-app-service-stack';
    app: 'sva-studio-react';
    services: readonly ['redis', 'loki', 'otel-collector', 'promtail'];
    containerArtifactVerified: false;
  }>;
}>;

const shaPattern = /^[0-9a-f]{40}$/u;
const refPattern = /^refs\/(?:heads|tags)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;
const branchPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;

const hasExactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasValidRun = (value: unknown): value is AppE2EEvidence['run'] =>
  isRecord(value) &&
  hasExactKeys(value, ['attempt', 'id']) &&
  typeof value.id === 'string' &&
  typeof value.attempt === 'number';

const hasValidSubject = (value: unknown): value is AppE2EEvidence['subject'] =>
  isRecord(value) &&
  hasExactKeys(value, ['app', 'containerArtifactVerified', 'kind', 'services']) &&
  value.kind === 'local-app-service-stack' &&
  value.app === 'sva-studio-react' &&
  value.containerArtifactVerified === false &&
  Array.isArray(value.services) &&
  value.services.join(',') === 'redis,loki,otel-collector,promtail';

const hasValidPrimitiveFields = (
  candidate: Partial<AppE2EEvidence>
): candidate is Partial<AppE2EEvidence> & {
  workflow: string;
  event: string;
  ref: string;
  branch: string;
  headSha: string;
  result: string;
  testOutcome: string;
  evidenceClass: string;
} =>
  typeof candidate.workflow === 'string' &&
  typeof candidate.event === 'string' &&
  typeof candidate.ref === 'string' &&
  typeof candidate.branch === 'string' &&
  typeof candidate.headSha === 'string' &&
  typeof candidate.result === 'string' &&
  typeof candidate.testOutcome === 'string' &&
  typeof candidate.evidenceClass === 'string';

const validateSourceIdentity = (input: {
  workflow: string;
  event: string;
  ref: string;
  branch: string;
  headSha: string;
}): void => {
  if (input.workflow !== 'App E2E') throw new Error('Ungültiger E2E-Workflow.');
  if (!['push', 'schedule', 'workflow_dispatch'].includes(input.event))
    throw new Error('Ungültiges E2E-Event.');
  if (!refPattern.test(input.ref) || input.ref.includes('..')) throw new Error('Ungültiger Ref.');
  if (!branchPattern.test(input.branch) || input.branch.includes('..'))
    throw new Error('Ungültiger Branch.');
  if (!shaPattern.test(input.headSha)) throw new Error('Ungültiges Head-SHA.');
};

const validateRunIdentity = (runId: string, runAttempt: number): void => {
  if (!/^\d+$/u.test(runId)) throw new Error('Ungültige Run-ID.');
  if (!Number.isSafeInteger(runAttempt) || runAttempt < 1)
    throw new Error('Ungültiger Run-Attempt.');
};

const normalizeOutcome = (
  result: string,
  rawTestOutcome: string
): Pick<AppE2EEvidence, 'result' | 'testOutcome'> => {
  if (!['success', 'failure', 'cancelled'].includes(result))
    throw new Error('Ungültiges Ergebnis.');
  if (!['success', 'failure', 'cancelled', 'skipped', ''].includes(rawTestOutcome))
    throw new Error('Ungültiges Testergebnis.');
  const testOutcome =
    rawTestOutcome === '' || rawTestOutcome === 'skipped'
      ? 'not-run'
      : (rawTestOutcome as AppE2EEvidence['testOutcome']);
  if (result === 'success' && testOutcome !== 'success')
    throw new Error('Erfolgreiches Job-Ergebnis ohne erfolgreichen E2E-Test.');
  if (result === 'failure' && testOutcome === 'cancelled')
    throw new Error('Fehlgeschlagenes Job-Ergebnis mit abgebrochenem E2E-Test.');
  return { result: result as AppE2EEvidence['result'], testOutcome };
};

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
  validateSourceIdentity(input);
  validateRunIdentity(input.runId, input.runAttempt);
  const outcome = normalizeOutcome(input.result, input.testOutcome);
  const canonicalMain =
    input.event === 'push' && input.ref === 'refs/heads/main' && input.branch === 'main';
  return {
    schemaVersion: 1,
    workflow: 'App E2E',
    event: input.event as AppE2EEvidence['event'],
    ref: input.ref,
    branch: input.branch,
    headSha: input.headSha,
    run: { id: input.runId, attempt: input.runAttempt },
    result: outcome.result,
    testOutcome: outcome.testOutcome,
    evidenceClass: canonicalMain ? 'canonical-main' : 'diagnostic',
    subject: {
      kind: 'local-app-service-stack',
      app: 'sva-studio-react',
      services: ['redis', 'loki', 'otel-collector', 'promtail'],
      containerArtifactVerified: false,
    },
  };
};

export const parseAppE2EEvidence = (value: unknown): AppE2EEvidence | null => {
  if (!isRecord(value)) return null;
  if (
    !hasExactKeys(value, [
      'branch',
      'evidenceClass',
      'event',
      'headSha',
      'ref',
      'result',
      'run',
      'schemaVersion',
      'subject',
      'testOutcome',
      'workflow',
    ])
  )
    return null;
  const candidate = value as Partial<AppE2EEvidence>;
  if (
    candidate.schemaVersion !== 1 ||
    !hasValidRun(candidate.run) ||
    !hasValidSubject(candidate.subject) ||
    !['canonical-main', 'diagnostic'].includes(candidate.evidenceClass ?? '')
  )
    return null;
  if (!hasValidPrimitiveFields(candidate)) return null;
  try {
    const evidence = buildAppE2EEvidence({
      workflow: candidate.workflow,
      event: candidate.event,
      ref: candidate.ref,
      branch: candidate.branch,
      headSha: candidate.headSha,
      runId: candidate.run.id,
      runAttempt: candidate.run.attempt,
      result: candidate.result,
      testOutcome: candidate.testOutcome === 'not-run' ? '' : candidate.testOutcome,
    });
    return evidence.evidenceClass === candidate.evidenceClass &&
      evidence.testOutcome === candidate.testOutcome
      ? evidence
      : null;
  } catch {
    return null;
  }
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
      `## App E2E\n\n- Ergebnis: ${evidence.result}\n- E2E-Test-Step: ${evidence.testOutcome}\n- Evidenzklasse: ${evidence.evidenceClass}\n- Head-SHA: ${evidence.headSha}\n- Prüfgegenstand: lokaler App-/Service-Stack (kein Container-Artefakt verifiziert)\n- Run/Attempt: ${evidence.run.id}/${evidence.run.attempt}\n`,
      'utf8'
    );
  }
  return outputPath;
};
