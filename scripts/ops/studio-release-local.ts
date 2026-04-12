import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseRuntimeCliOptions,
  resolveAcceptanceDeployOptions,
  type AcceptanceDeployOptions,
  type RuntimeCliOptions,
} from './runtime-env.shared.ts';

export type LocalStudioReleaseStepName = 'precheck' | 'deploy' | 'smoke' | 'feedback';

export type LocalStudioReleaseStep = {
  args: readonly string[];
  env: NodeJS.ProcessEnv;
  name: LocalStudioReleaseStepName;
};

export type LocalStudioReleasePlan = {
  feedbackStep: LocalStudioReleaseStep;
  options: AcceptanceDeployOptions;
  steps: readonly LocalStudioReleaseStep[];
};

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = resolve(dirname(scriptPath), '../..');

const usage = () => {
  process.stderr.write(
    'Usage: tsx scripts/ops/studio-release-local.ts --image-digest=<sha256:...> --release-mode=<app-only|schema-and-app> --rollback-hint=<text> [--image-tag=<tag>] [--maintenance-window=<text>]\n',
  );
};

const requireExplicitCliValue = (value: string | undefined, flag: string, message?: string) => {
  if (!value?.trim()) {
    throw new Error(message ?? `Lokaler Studio-Release erfordert ${flag}.`);
  }
  return value.trim();
};

const resolveLocalOperatorActor = (env: NodeJS.ProcessEnv) =>
  env.SVA_REMOTE_DEPLOY_ACTOR?.trim() || env.USER?.trim() || env.LOGNAME?.trim() || 'local-operator';

const resolveLocalOperatorWorkflow = (env: NodeJS.ProcessEnv) =>
  env.SVA_REMOTE_DEPLOY_WORKFLOW?.trim() || 'studio-release-local';

export const buildLocalStudioReleasePlan = (
  rawArgs: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): LocalStudioReleasePlan => {
  const cliOptions: RuntimeCliOptions = parseRuntimeCliOptions(rawArgs);

  requireExplicitCliValue(cliOptions.imageDigest, '--image-digest=<sha256:...>');
  requireExplicitCliValue(cliOptions.releaseMode, '--release-mode=<app-only|schema-and-app>');
  requireExplicitCliValue(cliOptions.rollbackHint, '--rollback-hint=<text>');

  const operatorEnv: NodeJS.ProcessEnv = {
    ...env,
    SVA_IMAGE_REF: '',
    SVA_REMOTE_DEPLOY_ACTOR: resolveLocalOperatorActor(env),
    SVA_REMOTE_DEPLOY_WORKFLOW: resolveLocalOperatorWorkflow(env),
    SVA_REMOTE_OPERATOR_CONTEXT: 'local-operator',
    SVA_REMOTE_REPORT_SLUG: env.SVA_REMOTE_REPORT_SLUG?.trim() || 'studio-deploy-local',
  };

  const options = resolveAcceptanceDeployOptions(operatorEnv, cliOptions, 'studio');
  const stepEnv: NodeJS.ProcessEnv = {
    ...operatorEnv,
    SVA_IMAGE_DIGEST: options.imageDigest,
    SVA_IMAGE_REF: options.imageRef,
  };
  if (options.imageTag) {
    stepEnv.SVA_IMAGE_TAG = options.imageTag;
  } else {
    delete stepEnv.SVA_IMAGE_TAG;
  }

  const precheckArgs = ['env:precheck:studio', '--', '--json', `--image-digest=${options.imageDigest}`];
  if (options.imageTag) {
    precheckArgs.push(`--image-tag=${options.imageTag}`);
  }

  const deployArgs = [
    'env:deploy:studio',
    '--',
    '--json',
    `--release-mode=${options.releaseMode}`,
    `--actor=${options.actor}`,
    `--workflow=${options.workflow}`,
    `--rollback-hint=${options.rollbackHint}`,
    `--image-digest=${options.imageDigest}`,
    `--report-slug=${options.reportSlug}`,
  ];

  if (options.maintenanceWindow) {
    deployArgs.push(`--maintenance-window=${options.maintenanceWindow}`);
  }

  if (options.imageTag) {
    deployArgs.push(`--image-tag=${options.imageTag}`);
  }

  return {
    feedbackStep: {
      args: ['env:feedback:studio'],
      env: stepEnv,
      name: 'feedback',
    },
    options,
    steps: [
      {
        args: precheckArgs,
        env: stepEnv,
        name: 'precheck',
      },
      {
        args: deployArgs,
        env: stepEnv,
        name: 'deploy',
      },
      {
        args: ['env:smoke:studio', '--', '--json'],
        env: stepEnv,
        name: 'smoke',
      },
    ],
  };
};

const defaultStepRunner = (step: LocalStudioReleaseStep) => {
  const result = spawnSync('pnpm', step.args, {
    cwd: rootDir,
    env: step.env,
    stdio: 'inherit',
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`Schritt ${step.name} ist mit Exit-Code ${result.status} fehlgeschlagen.`);
  }

  if (result.error) {
    throw result.error;
  }
};

export const runLocalStudioReleasePlan = (
  plan: LocalStudioReleasePlan,
  runStep: (step: LocalStudioReleaseStep) => void = defaultStepRunner,
) => {
  let primaryFailure: Error | undefined;
  let feedbackFailure: Error | undefined;

  try {
    for (const step of plan.steps) {
      runStep(step);
    }
  } catch (error) {
    primaryFailure = error instanceof Error ? error : new Error(String(error));
  } finally {
    try {
      runStep(plan.feedbackStep);
    } catch (error) {
      feedbackFailure = error instanceof Error ? error : new Error(String(error));
    }
  }

  if (primaryFailure) {
    throw primaryFailure;
  }

  if (feedbackFailure) {
    throw feedbackFailure;
  }
};

export const main = (rawArgs = process.argv.slice(2)) => {
  try {
    const plan = buildLocalStudioReleasePlan(rawArgs);
    runLocalStudioReleasePlan(plan);
  } catch (error) {
    usage();
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
};

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main();
}
