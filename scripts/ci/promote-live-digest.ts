#!/usr/bin/env node
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { commandExists, runCapture } from '../ops/runtime/process.ts';
import { inspectRemoteServiceContract } from '../ops/runtime/remote-service-spec.ts';

const rootDir = resolve(import.meta.dirname, '../..');

const required = (value: string | undefined, label: string) => {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${label} darf nicht leer sein.`);
  return trimmed;
};

const main = async () => {
  const environment = process.argv[2];
  if (environment !== 'staging') throw new Error('Der Live-Digest-Nachweis ist nur für staging zulässig.');
  const expectedFlagIndex = process.argv.indexOf('--expected');
  const expectedImage = expectedFlagIndex === -1 ? undefined : required(process.argv[expectedFlagIndex + 1], '--expected');

  const quantumEndpoint = required(process.env.QUANTUM_ENDPOINT, 'QUANTUM_ENDPOINT');
  const stackName = `studio-${environment}`;
  const contract = await inspectRemoteServiceContract(
    {
      commandExists: (command) => commandExists(rootDir, command),
      runCapture: (command, args, env) => runCapture(rootDir, command, args, env),
    },
    process.env,
    { quantumEndpoint, serviceName: 'app', stackName },
  );
  const image = contract?.image?.trim();
  if (!image) throw new Error(`Der laufende App-Digest für ${stackName} konnte nicht aus der Remote-Service-Spec gelesen werden.`);
  if (expectedImage && image !== expectedImage) {
    throw new Error(`Der laufende App-Image-Ref stimmt nicht mit dem Zielartefakt überein: erwartet ${expectedImage}, erhalten ${image}.`);
  }

  const evidencePath = resolve(process.env.RUNNER_TEMP ?? rootDir, `promote-live-image-${process.env.GITHUB_RUN_ID ?? 'local'}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}.json`);
  writeFileSync(evidencePath, `${JSON.stringify({ environment, expectedImage, image, serviceName: contract?.serviceName ?? `${stackName}_app`, stackName }, null, 2)}\n`, 'utf8');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `previous_live_image=${image}\nevidence_path=${evidencePath}\n`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
