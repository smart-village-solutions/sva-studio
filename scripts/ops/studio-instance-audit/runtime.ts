import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseVarsFile } from '../runtime/vars-file.ts';

export type StudioAuditRuntime = Readonly<{
  env: NodeJS.ProcessEnv;
  profile: 'studio';
  reportsDir: string;
  rootDir: string;
}>;

const buildStudioProfileEnv = (rootDir: string, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const baseEnvPath = resolve(rootDir, 'config/runtime/base.vars');
  const profileEnvPath = resolve(rootDir, 'config/runtime/studio.vars');
  const localOverridePath = resolve(rootDir, 'config/runtime/studio.local.vars');
  const userQuantumEnvPath = env.HOME ? resolve(env.HOME, '.config/quantum/env') : '';

  const baseEnv = parseVarsFile(baseEnvPath);
  const profileEnv = parseVarsFile(profileEnvPath);
  const localOverrideEnv = existsSync(localOverridePath) ? parseVarsFile(localOverridePath) : {};
  const userQuantumEnv = userQuantumEnvPath && existsSync(userQuantumEnvPath) ? parseVarsFile(userQuantumEnvPath) : {};

  return {
    ...baseEnv,
    ...profileEnv,
    ...localOverrideEnv,
    ...userQuantumEnv,
    ...env,
    SVA_RUNTIME_PROFILE: 'studio',
    VITE_SVA_RUNTIME_PROFILE: 'studio',
  };
};

export const withStudioAuditEnv = async <T>(
  env: NodeJS.ProcessEnv,
  work: () => Promise<T>,
): Promise<T> => {
  const previousEntries = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(env)) {
    previousEntries.set(key, process.env[key]);
    if (typeof value === 'string') {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }

  try {
    return await work();
  } finally {
    for (const [key, previousValue] of previousEntries) {
      if (typeof previousValue === 'string') {
        process.env[key] = previousValue;
      } else {
        delete process.env[key];
      }
    }
  }
};

export const assertStudioAuditRuntime = (input: {
  commandExists: (name: string) => boolean;
  env: NodeJS.ProcessEnv;
  rootDir: string;
}): StudioAuditRuntime => {
  const runtimeEnv = buildStudioProfileEnv(input.rootDir, input.env);

  if ((runtimeEnv['SVA_RUNTIME_PROFILE'] ?? 'studio') !== 'studio') {
    throw new Error('Das Instanz-Audit darf nur gegen das studio-Profil laufen.');
  }

  if (!input.commandExists('kcadm.sh')) {
    throw new Error('kcadm.sh ist nicht verfügbar.');
  }

  if (!input.commandExists('quantum-cli')) {
    throw new Error('quantum-cli ist nicht verfügbar.');
  }

  if (!runtimeEnv.SVA_STACK_NAME?.trim()) {
    throw new Error('SVA_STACK_NAME fehlt für das studio-Instanz-Audit.');
  }

  if (!(runtimeEnv.QUANTUM_ENDPOINT?.trim() || runtimeEnv.PORTAINER_ENDPOINT?.trim())) {
    throw new Error('QUANTUM_ENDPOINT fehlt für das studio-Instanz-Audit.');
  }

  return {
    env: runtimeEnv,
    profile: 'studio',
    reportsDir: resolve(input.rootDir, 'docs/reports'),
    rootDir: input.rootDir,
  };
};
