import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildOneShotEvidence, parseArgs } from './promote-one-shot-job.ts';

describe('promote one-shot job', () => {
  it('accepts production one-shot jobs', () => {
    expect(parseArgs(['--kind', 'migration', '--environment', 'prod'])).toEqual({
      environment: 'prod',
      kind: 'migration',
    });
  });

  it.each([
    'person@example.test',
    'https://internal.example.test/jobs/1',
    'first line\nsecond line',
    'secret-key=should-not-leak',
  ])('does not publish free failure or log text: %s', (sentinel) => {
    const evidence = buildOneShotEvidence({
      environment: 'staging',
      failure: new Error(sentinel),
      kind: 'migration',
      result: {
        durationMs: 123,
        exitCode: 1,
        jobServiceName: 'migrate',
        jobStackName: sentinel,
        logTail: sentinel,
        state: sentinel,
        taskId: sentinel,
      } as Parameters<typeof buildOneShotEvidence>[0]['result'] & { logTail: string },
    });

    const published = JSON.stringify(evidence);
    expect(published).not.toContain(sentinel);
    expect(evidence).not.toHaveProperty('error');
    expect(evidence.job).not.toHaveProperty('logTail');
  });

  it.each(['person@example.test', 'https://internal.example.test/jobs/1', 'first line\nsecond line'])(
    'does not echo invalid CLI input to stderr: %s',
    (sentinel) => {
      const result = spawnSync(process.execPath, ['--import', 'tsx', resolve(import.meta.dirname, 'promote-one-shot-job.ts'), '--kind', sentinel, '--environment', 'staging'], { encoding: 'utf8' });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('PROMOTE_ONE_SHOT_FAILED');
      expect(result.stderr).not.toContain(sentinel);
    },
  );
});
