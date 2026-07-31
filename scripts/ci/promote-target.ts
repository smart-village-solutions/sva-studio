#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type PromoteEnvironment = 'dev' | 'prod' | 'staging';

export const stackNameForEnvironment = (environment: PromoteEnvironment): string =>
  environment === 'prod' ? 'studio' : `studio-${environment}`;

const main = () => {
  const environment = process.argv[2];
  if (environment !== 'dev' && environment !== 'staging' && environment !== 'prod') {
    throw new Error('Ungültige Zielumgebung; erwartet wird dev, staging oder prod.');
  }

  const stackName = stackNameForEnvironment(environment);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `stack_name=${stackName}\n`);
  } else {
    process.stdout.write(`${stackName}\n`);
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
