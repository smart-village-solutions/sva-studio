import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { redactPromoteFailure, writePromoteFailureRecord } from '../ci/promote-result.ts';

import {
  buildGuardrailDoctorChecks,
  main,
  runtimeEnvDangerousOperations,
  runtimeEnvRemoteVerification,
  runtimeEnvSmokeWarmup,
} from './runtime/runtime-facade.ts';
import { resolveRuntimeSmokePromoteEnvironment } from './runtime/smoke-runtime.ts';

export {
  buildGuardrailDoctorChecks,
  runtimeEnvDangerousOperations,
  runtimeEnvRemoteVerification,
  runtimeEnvSmokeWarmup,
};

export const formatRuntimeEnvCliFailure = (
  error: unknown,
  command: string | undefined,
  env: NodeJS.ProcessEnv,
) => {
  if (command === 'smoke') {
    const failure = redactPromoteFailure(error, {
      environment: resolveRuntimeSmokePromoteEnvironment(env),
      phase: 'external-smoke',
    });
    writePromoteFailureRecord(failure, env.PROMOTE_FAILURE_PATH);
    return `[runtime-env] ${failure.code}: ${failure.summary}`;
  }
  return '[runtime-env] RUNTIME_ENV_COMMAND_FAILED: Der Runtime-Befehl ist fehlgeschlagen.';
};

const entryScriptPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentScriptPath = fileURLToPath(import.meta.url);

if (entryScriptPath === currentScriptPath) {
  main().catch((error: unknown) => {
    console.error(formatRuntimeEnvCliFailure(error, process.argv[2], process.env));
    process.exit(1);
  });
}
