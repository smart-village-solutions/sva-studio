import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildLocalStudioReleasePlan, runLocalStudioReleasePlan } from '../../../scripts/ops/studio-release-local.ts';

describe('studio-release-local', () => {
  it('requires an explicit image digest from the CLI', () => {
    expect(() =>
      buildLocalStudioReleasePlan([
        '--release-mode=app-only',
        '--rollback-hint=Redeploy previous digest',
      ]),
    ).toThrow(/--image-digest/);
  });

  it('requires an explicit release mode from the CLI', () => {
    expect(() =>
      buildLocalStudioReleasePlan([
        '--image-digest=sha256:abc',
        '--rollback-hint=Redeploy previous digest',
      ]),
    ).toThrow(/--release-mode/);
  });

  it('requires an explicit rollback hint from the CLI', () => {
    expect(() =>
      buildLocalStudioReleasePlan([
        '--image-digest=sha256:abc',
        '--release-mode=app-only',
      ]),
    ).toThrow(/--rollback-hint/);
  });

  it('requires a maintenance window for schema-and-app releases', () => {
    expect(() =>
      buildLocalStudioReleasePlan([
        '--image-digest=sha256:abc',
        '--release-mode=schema-and-app',
        '--rollback-hint=Redeploy previous digest',
      ]),
    ).toThrow(/Wartungsfenster/);
  });

  it('builds the canonical local release sequence for app-only releases', () => {
    const plan = buildLocalStudioReleasePlan(
      [
        '--image-digest=sha256:abc',
        '--release-mode=app-only',
        '--rollback-hint=Redeploy previous digest',
        '--image-tag=ba0261f8fa33',
      ],
      {
        USER: 'wilimzig',
      },
    );

    expect(plan.options.actor).toBe('wilimzig');
    expect(plan.options.workflow).toBe('studio-release-local');
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0]).toMatchObject({
      name: 'precheck',
      args: [
        'env:precheck:studio',
        '--',
        '--json',
        '--image-digest=sha256:abc',
        '--image-tag=ba0261f8fa33',
      ],
    });
    expect(plan.steps[1]).toMatchObject({
      name: 'deploy',
    });
    expect(plan.steps[1]?.args).toContain('--json');
    expect(plan.steps[1]?.args).toContain('--release-mode=app-only');
    expect(plan.steps[1]?.args).toContain('--image-digest=sha256:abc');
    expect(plan.steps[1]?.args).toContain('--image-tag=ba0261f8fa33');
    expect(plan.steps[2]).toMatchObject({
      name: 'smoke',
      args: ['env:smoke:studio', '--', '--json'],
    });
    expect(plan.feedbackStep).toMatchObject({
      name: 'feedback',
      args: ['env:feedback:studio'],
    });
    expect(plan.steps[0]?.env.SVA_REMOTE_OPERATOR_CONTEXT).toBe('local-operator');
  });

  it('runs feedback even when a primary step fails', () => {
    const plan = buildLocalStudioReleasePlan([
      '--image-digest=sha256:abc',
      '--release-mode=app-only',
      '--rollback-hint=Redeploy previous digest',
    ]);
    const executed: string[] = [];

    expect(() =>
      runLocalStudioReleasePlan(plan, (step) => {
        executed.push(step.name);
        if (step.name === 'deploy') {
          throw new Error('deploy failed');
        }
      }),
    ).toThrow(/deploy failed/);

    expect(executed).toEqual(['precheck', 'deploy', 'feedback']);
  });
});
