import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(
  new URL('../../.opencode/skills/monitor-ci/scripts/ci-poll-decide.mjs', import.meta.url)
);
const decide = (ci: unknown, flags: string[] = []) =>
  JSON.parse(
    execFileSync(process.execPath, [scriptPath, JSON.stringify(ci), '0', 'medium', ...flags], {
      encoding: 'utf8',
      env: {
        NODE_V8_COVERAGE: process.env.NODE_V8_COVERAGE,
      },
    })
  );

describe('CI poll decision priority and task categories', () => {
  it.each([
    [[], [], 'fix_apply_ready', undefined],
    [['app:e2e'], [], 'fix_apply_ready', undefined],
    [['app:e2e:ci', 'app:unit', 'bare'], ['app:unit'], 'fix_needs_local_verify', ['bare']],
    [['app:unit'], ['app:unit'], 'fix_apply_ready', undefined],
  ])('categorizes failed tasks %j verified %j', (failedTaskIds, verifiedTaskIds, code, tasks) => {
    const result = decide({
      cipeStatus: 'FAILED',
      selfHealingStatus: 'COMPLETED',
      verificationStatus: 'COMPLETED',
      failedTaskIds,
      verifiedTaskIds,
    });
    expect(result.code).toBe(code);
    expect(result.verifiableTaskIds).toEqual(tasks);
  });

  it('resets progress only for supplied previous state values that changed', () => {
    const ci = {
      cipeStatus: 'IN_PROGRESS',
      selfHealingStatus: 'NOT_STARTED',
      verificationStatus: 'NOT_STARTED',
      failureClassification: 'FLAKY_TASK',
    };
    expect(decide(ci, ['--no-progress-count', '5']).noProgressCount).toBe(6);
    expect(
      decide(ci, ['--no-progress-count', '5', '--prev-cipe-status', 'IN_PROGRESS']).noProgressCount
    ).toBe(6);
    expect(
      decide(ci, ['--no-progress-count', '5', '--prev-sh-status', 'COMPLETED']).noProgressCount
    ).toBe(0);
    expect(
      decide(ci, ['--no-progress-count', '5', '--prev-failure-classification', 'flaky_task'])
        .noProgressCount
    ).toBe(6);
  });

  it('preserves timeout, success and environment priority', () => {
    const ci = { cipeStatus: 'SUCCEEDED', failureClassification: 'environment_state' };
    expect(decide(ci).code).toBe('ci_success');
    expect(decide(ci, ['--timeout', '1', '--elapsed-seconds', '60']).code).toBe('polling_timeout');
    expect(
      decide({ cipeStatus: 'IN_PROGRESS', failureClassification: 'environment_state' }, [
        '--env-rerun-count',
        '2',
      ]).code
    ).toBe('environment_rerun_cap');
    expect(decide({ cipeStatus: 'FAILED', failedTaskIds: [] }).code).toBe('cipe_no_tasks');
  });
});
