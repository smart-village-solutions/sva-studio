import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { isWorkerEntrypoint } from './worker.js';

describe('isWorkerEntrypoint', () => {
  it('accepts relative argv entry paths', () => {
    const argvEntry = 'node_modules/@sva/auth/dist/iam-instance-registry/worker.js';
    const moduleUrl = pathToFileURL(resolve(argvEntry)).href;

    expect(isWorkerEntrypoint(moduleUrl, argvEntry)).toBe(true);
  });

  it('returns false without argv entry', () => {
    expect(isWorkerEntrypoint('file:///app/worker.js', undefined)).toBe(false);
  });
});
