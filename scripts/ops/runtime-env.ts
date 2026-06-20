import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import {
  buildGuardrailDoctorChecks,
  main,
  runtimeEnvDangerousOperations,
  runtimeEnvRemoteVerification,
  runtimeEnvSmokeWarmup,
} from './runtime/runtime-facade.ts';

export {
  buildGuardrailDoctorChecks,
  runtimeEnvDangerousOperations,
  runtimeEnvRemoteVerification,
  runtimeEnvSmokeWarmup,
};

const entryScriptPath = process.argv[1] ? resolve(process.argv[1]) : null;
const currentScriptPath = fileURLToPath(import.meta.url);

if (entryScriptPath === currentScriptPath) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[runtime-env] ${message}`);
    process.exit(1);
  });
}
