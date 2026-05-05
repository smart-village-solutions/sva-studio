import { describe, expect, it } from 'vitest';

import type { LocalStudioReleasePlan, LocalStudioReleaseStepName } from './studio-release-local.ts';
import { runLocalStudioReleasePlan } from './studio-release-local.ts';

const createPlan = (): LocalStudioReleasePlan => ({
  feedbackStep: {
    args: ['env:feedback:studio'],
    env: {},
    name: 'feedback',
  },
  options: {
    actor: 'tester',
    imageDigest: 'sha256:test',
    imageRef: 'ghcr.io/smart-village-solutions/sva-studio@sha256:test',
    imageRepository: 'sva-studio',
    releaseMode: 'app-only',
    reportSlug: 'studio-deploy-local',
    rollbackHint: 'rollback',
    workflow: 'studio-release-local',
  },
  steps: [
    {
      args: ['env:precheck:studio'],
      env: {},
      name: 'precheck',
    },
    {
      args: ['env:deploy:studio'],
      env: {},
      name: 'deploy',
    },
    {
      args: ['env:smoke:studio'],
      env: {},
      name: 'smoke',
    },
  ],
});

describe('runLocalStudioReleasePlan', () => {
  it('continues to smoke after a deploy failure and accepts the release when smoke passes', () => {
    const calls: LocalStudioReleaseStepName[] = [];

    expect(() =>
      runLocalStudioReleasePlan(createPlan(), (step) => {
        calls.push(step.name);
        if (step.name === 'deploy') {
          throw new Error('deploy failed during cutover');
        }
      }),
    ).not.toThrow();

    expect(calls).toEqual(['precheck', 'deploy', 'smoke', 'feedback']);
  });
});
