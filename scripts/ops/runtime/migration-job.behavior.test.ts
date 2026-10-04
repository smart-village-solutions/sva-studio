import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { runMigrationJobAgainstAcceptance } from './migration-job.ts';

const compose = {
  name: 'studio',
  services: { migrate: { image: 'example/app', environment: {} } },
};
const input = {
  internalNetworkName: 'studio_internal',
  quantumEndpoint: 'endpoint',
  remoteComposeFile: 'compose.yml',
  reportId: 'run-1',
  runtimeProfile: 'staging',
  sourceStackName: 'studio',
};

const createDeps = (state: string, exitCode: number) => {
  const events: string[] = [];
  const run = vi.fn((_root: string, _command: string, args: readonly string[]) => {
    events.push(args[1] ?? '');
  });
  const runCapture = vi.fn((...invocation: [string, string, readonly string[]]) => {
    if (invocation[1] !== 'docker') throw new Error(`Unexpected command: ${invocation[1]}`);
    return JSON.stringify(compose);
  });
  const runCaptureDetailed = vi.fn(() => ({
    output: [],
    pid: 1,
    signal: null,
    status: 0,
    stderr: '',
    stdout: JSON.stringify([
      { ID: 'task-1', Status: { State: state, ContainerStatus: { ExitCode: exitCode } } },
    ]),
  }));
  const deps: Parameters<typeof runMigrationJobAgainstAcceptance>[0] = {
    commandExists: vi.fn(() => true),
    rootDir: '/repo',
    run,
    runCapture,
    runCaptureDetailed,
    spawnBackground: vi.fn(),
    wait: vi.fn(async () => undefined),
  };
  return { deps, events, run, runCapture, runCaptureDetailed };
};

describe('migration job lifecycle', () => {
  it('renders, deploys, polls, and removes the stack and temporary compose on successful cleanup', async () => {
    const { deps, events, run, runCapture, runCaptureDetailed } = createDeps('complete', 0);
    const result = await runMigrationJobAgainstAcceptance(deps, {}, input);
    const composePath = (run.mock.calls[0]?.[2] as string[])[3];

    expect(runCapture.mock.calls[0]?.[1]).toBe('docker');
    expect(events).toEqual(['deploy']);
    expect(runCaptureDetailed).toHaveBeenCalledOnce();
    expect(result.state).toBe('complete');
    expect(existsSync(composePath)).toBe(true);

    await result.cleanup();
    expect(events).toEqual(['deploy', 'remove']);
    expect(existsSync(composePath)).toBe(false);
  });

  it('removes a failed remote stack and temporary compose while preserving the task error', async () => {
    const { deps, events, run } = createDeps('failed', 1);
    await expect(runMigrationJobAgainstAcceptance(deps, {}, input)).rejects.toThrow();
    const composePath = (run.mock.calls[0]?.[2] as string[])[3];
    expect(events).toEqual(['deploy', 'remove']);
    expect(existsSync(composePath)).toBe(false);
  });

  it('keeps a failed stack only when explicitly configured, and still removes the temporary compose', async () => {
    const { deps, events, run } = createDeps('failed', 1);
    await expect(
      runMigrationJobAgainstAcceptance(deps, { SVA_MIGRATION_JOB_KEEP_FAILED_STACK: 'true' }, input)
    ).rejects.toThrow();
    const composePath = (run.mock.calls[0]?.[2] as string[])[3];
    expect(events).toEqual(['deploy']);
    expect(existsSync(composePath)).toBe(false);
  });
});
