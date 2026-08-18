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
        jobStackName: 'studio-staging-migrate-gha-1-1',
        logTail: sentinel,
        state: 'failed',
        taskId: 'task-1',
      } as Parameters<typeof buildOneShotEvidence>[0]['result'] & { logTail: string },
    });

    const published = JSON.stringify(evidence);
    expect(published).not.toContain(sentinel);
    expect(evidence).not.toHaveProperty('error');
    expect(evidence.job).not.toHaveProperty('logTail');
  });
});
