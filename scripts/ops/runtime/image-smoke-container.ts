import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AcceptanceDeployOptions, AcceptanceProbeResult } from '../runtime-env.shared.ts';
import type { ImageSmokeContainer, RuntimeImageSmokeDeps } from './image-smoke.types.ts';

export const buildImageSmokeContainer = async (
  deps: RuntimeImageSmokeDeps,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  reportId: string,
  buildRuntimeEnvEntries: (env: NodeJS.ProcessEnv) => Promise<readonly string[]>,
): Promise<ImageSmokeContainer> => {
  deps.ensureDirs();
  const smokePort = Number(env.SVA_IMAGE_SMOKE_PORT ?? '39080');
  const containerName = `${reportId}-image-smoke`.replace(/[^a-z0-9-]/giu, '-').toLowerCase();
  const envFilePath = resolve(deps.runtimeArtifactsDir, `${containerName}.env`);
  const runtimeEnvEntries = await buildRuntimeEnvEntries(env);
  writeFileSync(envFilePath, `${runtimeEnvEntries.join('\n')}\n`, 'utf8');

  return {
    containerName,
    envFilePath,
    smokeBaseUrl: `http://host.docker.internal:${smokePort}`,
    smokePort,
    start: () =>
      deps.runCaptureDetailed(
        'docker',
        [
          'run',
          '-d',
          '--name',
          containerName,
          '--add-host',
          'host.docker.internal:host-gateway',
          '--env-file',
          envFilePath,
          '-e',
          `SVA_PUBLIC_BASE_URL=http://host.docker.internal:${smokePort}`,
          '-p',
          `127.0.0.1:${smokePort}:3000`,
          options.imageRef,
        ],
        env,
      ),
  };
};

export const cleanupImageSmokeContainer = (
  deps: RuntimeImageSmokeDeps,
  containerName: string,
  envFilePath: string,
  env: NodeJS.ProcessEnv,
) => {
  try {
    deps.runCaptureDetailed('docker', ['rm', '-f', containerName], env);
  } catch {
    // ignore cleanup failures
  }

  if (!existsSync(envFilePath)) {
    return;
  }

  try {
    unlinkSync(envFilePath);
  } catch {
    // ignore cleanup failures
  }
};

export const waitForContainerHttpOk = async (
  deps: RuntimeImageSmokeDeps,
  containerName: string,
  path: string,
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = deps.runCaptureDetailed(
      'docker',
      ['exec', containerName, 'node', '-e', `fetch('http://127.0.0.1:3000${path}').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))`],
      env,
    );
    if (result.status === 0) {
      return;
    }
    await deps.wait(1_000);
  }

  throw new Error(`Timeout waiting for container ${containerName} ${path}`);
};

export const runContainerHttpProbe = async (
  deps: RuntimeImageSmokeDeps,
  containerName: string,
  path: string,
  env: NodeJS.ProcessEnv,
  input: {
    expect: (response: { ok: boolean; status: number }, payload: unknown) => string | null;
    name: string;
    scope: AcceptanceProbeResult['scope'];
    target: string;
  },
): Promise<AcceptanceProbeResult> => {
  const startedAt = Date.now();

  try {
    const script = [
      'const url = process.argv[1];',
      'fetch(url)',
      '  .then(async (response) => {',
      '    const text = await response.text();',
      '    process.stdout.write(JSON.stringify({ ok: response.ok, status: response.status, text }));',
      '  })',
      '  .catch((error) => {',
      '    console.error(error instanceof Error ? error.message : String(error));',
      '    process.exit(1);',
      '  });',
    ].join('');
    const result = deps.runCaptureDetailed('docker', ['exec', containerName, 'node', '-e', script, `http://127.0.0.1:3000${path}`], env);

    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout.trim() || 'Container-HTTP-Probe fehlgeschlagen.');
    }

    const parsed = JSON.parse(result.stdout.trim()) as { ok: boolean; status: number; text: string };
    let payload: unknown;

    try {
      payload = parsed.text.length > 0 ? JSON.parse(parsed.text) : null;
    } catch {
      payload = parsed.text;
    }

    const expectationError = input.expect({ ok: parsed.ok, status: parsed.status }, payload);
    return deps.createProbeResult({
      ...(expectationError ? { details: { payload } } : {}),
      durationMs: Date.now() - startedAt,
      httpStatus: parsed.status,
      message: expectationError ?? `Probe erfolgreich mit HTTP ${parsed.status}.`,
      name: input.name,
      scope: input.scope,
      status: expectationError ? 'error' : 'ok',
      target: input.target,
    });
  } catch (error) {
    return deps.createProbeResult({
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      name: input.name,
      scope: input.scope,
      status: 'error',
      target: input.target,
    });
  }
};

export const withStartedImageSmokeContainer = async <T>(
  deps: RuntimeImageSmokeDeps,
  env: NodeJS.ProcessEnv,
  options: AcceptanceDeployOptions,
  reportId: string,
  buildRuntimeEnvEntries: (env: NodeJS.ProcessEnv) => Promise<readonly string[]>,
  work: (input: { containerName: string; smokeBaseUrl: string; smokePort: number }) => Promise<T>,
): Promise<T> => {
  const container = await buildImageSmokeContainer(deps, env, options, reportId, buildRuntimeEnvEntries);

  try {
    deps.runCaptureDetailed('docker', ['rm', '-f', container.containerName], env);
  } catch {
    // ignore stale container
  }

  try {
    const runResult = container.start();
    if (runResult.status !== 0) {
      throw new Error(runResult.stderr?.trim() || runResult.stdout.trim() || 'Image-Smoke-Container konnte nicht gestartet werden.');
    }

    await waitForContainerHttpOk(deps, container.containerName, '/health/live', 60_000, env);
    return await work(container);
  } finally {
    cleanupImageSmokeContainer(deps, container.containerName, container.envFilePath, env);
  }
};
