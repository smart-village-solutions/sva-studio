import { describe, expect, it, vi } from 'vitest';

import {
  classifySwarmConvergenceFailure,
  evaluateSwarmConvergence,
  parsePositiveDuration,
  waitForSwarmConvergence,
} from './verify-swarm-convergence.ts';
import { buildPromoteFailure, PromoteContractError } from './promote-result.ts';

const service = (
  shortName: string,
  runningReplicas: number,
  desiredReplicas = 1,
  state = runningReplicas === desiredReplicas ? 'running' : 'failed'
) => ({
  desiredReplicas,
  name: `studio-staging_${shortName}`,
  runningReplicas,
  shortName,
  tasks: [{ desiredState: 'running', exitCode: state === 'failed' ? 1 : undefined, state }],
  updateState: state === 'failed' ? 'paused' : 'completed',
});

describe('Swarm convergence verification', () => {
  it('accepts only when every desired service replica is running and updates are terminal', () => {
    expect(
      evaluateSwarmConvergence({
        channel: 'portainer-api',
        stackName: 'studio-staging',
        services: [service('app', 1), service('provisioner', 1), service('postgres', 1)],
      })
    ).toMatchObject({ status: 'converged' });
  });

  it('fails immediately for a paused update with a failed latest task', () => {
    expect(
      evaluateSwarmConvergence({
        channel: 'portainer-api',
        stackName: 'studio-staging',
        services: [service('app', 0)],
      })
    ).toMatchObject({
      services: [
        {
          desiredReplicas: 1,
          latestTaskExitCode: 1,
          latestTaskState: 'failed',
          runningReplicas: 0,
          shortName: 'app',
          updateState: 'paused',
        },
      ],
      status: 'terminal-failure',
    });
  });

  it('polls pending states and returns before HTTP verification may start', async () => {
    const snapshots = [
      {
        channel: 'portainer-api' as const,
        stackName: 'studio-staging',
        services: [service('app', 0, 1, 'starting')],
      },
      {
        channel: 'portainer-api' as const,
        stackName: 'studio-staging',
        services: [service('app', 1)],
      },
    ];
    const inspect = vi.fn().mockResolvedValueOnce(snapshots[0]).mockResolvedValueOnce(snapshots[1]);
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(
      waitForSwarmConvergence({ inspect, timeoutMs: 5_000, pollIntervalMs: 10, wait })
    ).resolves.toMatchObject({ status: 'converged' });
    expect(inspect).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledOnce();
  });

  it('returns a pending snapshot as terminal timeout evidence without starting HTTP', async () => {
    const pending = {
      channel: 'portainer-api' as const,
      stackName: 'studio-staging',
      services: [service('app', 0, 1, 'starting')],
    };
    const wait = vi.fn().mockResolvedValue(undefined);
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(5_000);

    await expect(
      waitForSwarmConvergence({
        inspect: vi.fn().mockResolvedValue(pending),
        now,
        timeoutMs: 5_000,
        pollIntervalMs: 10,
        wait,
      })
    ).resolves.toMatchObject({ status: 'pending' });
    expect(wait).not.toHaveBeenCalled();
  });

  it('keeps expected convergence failure distinct from redacted API errors', () => {
    const expected = new PromoteContractError(
      buildPromoteFailure({
        code: 'PROMOTE_SWARM_CONVERGENCE_TIMEOUT',
        environment: 'staging',
        phase: 'swarm-convergence',
      })
    );
    expect(classifySwarmConvergenceFailure(expected, 'staging').code).toBe(
      'PROMOTE_SWARM_CONVERGENCE_TIMEOUT'
    );
    const internal = classifySwarmConvergenceFailure(
      new Error('person@example.test https://internal.example.test secret=value'),
      'staging'
    );
    expect(JSON.stringify(internal)).not.toMatch(/person@|https:|secret=value/u);
    expect(internal.code).toBe('PROMOTE_INTERNAL_ERROR');
  });

  it('rejects invalid polling durations instead of waiting forever', () => {
    expect(parsePositiveDuration(undefined, 3_000)).toBe(3_000);
    expect(() => parsePositiveDuration('NaN', 3_000)).toThrow(/Konvergenzzeit/u);
    expect(() => parsePositiveDuration('0', 3_000)).toThrow(/Konvergenzzeit/u);
  });

  it('does not persist free API strings in allowlisted convergence evidence', () => {
    const sentinel = 'person@example.test https://internal.example.test\nsecret=value';
    const result = evaluateSwarmConvergence({
      channel: 'portainer-api',
      stackName: 'studio-staging',
      services: [
        {
          desiredReplicas: 1,
          name: sentinel,
          runningReplicas: 0,
          shortName: sentinel,
          tasks: [{ state: sentinel }],
          updateState: sentinel,
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(result.services[0]).toMatchObject({ shortName: 'invalid-service' });
  });
});
