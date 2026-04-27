import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildMigrationJobComposeDocument,
  collectQuantumTaskSnapshots,
  extractQuantumJsonPayload,
  fetchPortainerDockerText,
  getMigrationJobTerminalState,
  readRemoteJobLogTail,
  runMigrationJobAgainstAcceptance,
  selectLatestMigrationTask,
} from '../../../scripts/ops/runtime/migration-job.ts';

describe('migration-job runtime helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('derives a dedicated one-off migrate compose from the rendered stack compose', () => {
    const result = buildMigrationJobComposeDocument(
      {
        services: {
          app: {
            image: 'ghcr.io/example/app@sha256:abc',
          },
          migrate: {
            command: null,
            image: 'ghcr.io/example/app@sha256:abc',
            entrypoint: ['./migrate-entrypoint.sh'],
            environment: {
              POSTGRES_DB: 'sva_studio',
            },
            deploy: {
              replicas: 0,
              resources: {
                limits: {
                  cpus: 0.5,
                },
              },
              restart_policy: {
                condition: 'none',
              },
            },
            networks: ['internal'],
          },
        },
      },
      {
        internalNetworkName: 'studio_default',
        jobStackName: 'studio-migrate-20260407',
        sourceStackName: 'studio',
        targetReplicas: 1,
      },
    );

    expect(result).toEqual({
      version: '3.8',
      networks: {
        internal: {
          external: true,
          name: 'studio_default',
        },
      },
      services: {
        migrate: {
          image: 'ghcr.io/example/app@sha256:abc',
          entrypoint: ['./migrate-entrypoint.sh'],
          environment: {
            POSTGRES_DB: 'sva_studio',
            POSTGRES_HOST: 'studio_postgres',
            SVA_MIGRATION_JOB_STACK: 'studio-migrate-20260407',
            SVA_MIGRATION_TARGET_STACK: 'studio',
          },
          deploy: {
            replicas: 1,
            resources: {
              limits: {
                cpus: '0.5',
              },
            },
            restart_policy: {
              condition: 'none',
            },
          },
          networks: ['internal'],
        },
      },
    });
  });

  it('keeps the full stack shape and can scale the migrate service back to zero', () => {
    const result = buildMigrationJobComposeDocument(
      {
        name: 'studio',
        networks: {
          internal: {
            driver: 'overlay',
          },
        },
        services: {
          migrate: {
            command: null,
            image: 'ghcr.io/example/app@sha256:abc',
            deploy: {
              replicas: 0,
            },
          },
        },
      },
      {
        internalNetworkName: 'studio_default',
        jobStackName: 'studio',
        sourceStackName: 'studio',
        targetReplicas: 0,
      },
    );

    expect(result).toEqual({
      version: '3.8',
      networks: {
        internal: {
          external: true,
          name: 'studio_default',
        },
      },
      services: {
        migrate: {
          image: 'ghcr.io/example/app@sha256:abc',
          networks: ['internal'],
          environment: {
            POSTGRES_HOST: 'studio_postgres',
            SVA_MIGRATION_JOB_STACK: 'studio',
            SVA_MIGRATION_TARGET_STACK: 'studio',
          },
          deploy: {
            replicas: 0,
            restart_policy: {
              condition: 'none',
            },
          },
        },
      },
    });
  });

  it('picks the newest task snapshot and detects success via terminal state plus exit code', () => {
    const task = selectLatestMigrationTask([
      {
        CreatedAt: '2026-04-07T18:00:00.000000000Z',
        DesiredState: 'shutdown',
        ID: 'older',
        Status: {
          ContainerStatus: {
            ExitCode: 1,
          },
          Message: 'failed',
          State: 'failed',
          Timestamp: '2026-04-07T18:00:05.000000000Z',
        },
      },
      {
        CreatedAt: '2026-04-07T18:05:00.000000000Z',
        DesiredState: 'shutdown',
        ID: 'newer',
        Status: {
          ContainerStatus: {
            ExitCode: 0,
          },
          Message: 'finished',
          State: 'complete',
          Timestamp: '2026-04-07T18:05:05.000000000Z',
        },
      },
    ]);

    expect(task?.taskId).toBe('newer');
    expect(getMigrationJobTerminalState(task ?? null)).toBe('succeeded');
  });

  it('keeps already normalized task snapshots intact when selecting the latest task', () => {
    const task = selectLatestMigrationTask([
      {
        createdAt: '2026-04-07T18:00:00.000000000Z',
        exitCode: 1,
        state: 'failed',
        taskId: 'older',
        updatedAt: '2026-04-07T18:00:05.000000000Z',
      },
      {
        createdAt: '2026-04-07T18:05:00.000000000Z',
        exitCode: 0,
        message: 'finished',
        state: 'complete',
        taskId: 'newer',
        updatedAt: '2026-04-07T18:05:05.000000000Z',
      },
    ]);

    expect(task).toEqual({
      createdAt: '2026-04-07T18:05:00.000000000Z',
      exitCode: 0,
      message: 'finished',
      state: 'complete',
      taskId: 'newer',
      updatedAt: '2026-04-07T18:05:05.000000000Z',
    });
    expect(getMigrationJobTerminalState(task)).toBe('succeeded');
  });

  it('treats non-zero exit codes and failed states as terminal migration job failures', () => {
    expect(
      getMigrationJobTerminalState({
        exitCode: 23,
        state: 'complete',
        taskId: 'failed-complete',
      }),
    ).toBe('failed');

    expect(
      getMigrationJobTerminalState({
        state: 'rejected',
        taskId: 'rejected',
      }),
    ).toBe('failed');
  });

  it('extracts pretty-printed JSON payloads from filtered quantum output lines', () => {
    expect(
      extractQuantumJsonPayload([
        'time=2026-04-07T21:15:48.233+02:00 level=DEBUG msg="ignored"',
        '{',
        '  "stacks": {',
        '    "studio": []',
        '  }',
        '}',
      ]),
    ).toBe('{\n  "stacks": {\n    "studio": []\n  }\n}');
  });

  it('collects task snapshots from the nested quantum ps json structure', () => {
    expect(
      collectQuantumTaskSnapshots({
        stacks: {
          studio: [
            {
              service: {
                ID: 'service-1',
              },
              tasks: [
                {
                  CreatedAt: '2026-04-07T18:05:00.000000000Z',
                  ID: 'task-1',
                  Status: {
                    ContainerStatus: {
                      ExitCode: 1,
                    },
                    Message: 'failed',
                    State: 'failed',
                    Timestamp: '2026-04-07T18:05:05.000000000Z',
                  },
                },
              ],
            },
          ],
        },
      }),
    ).toEqual([
      {
        createdAt: '2026-04-07T18:05:00.000000000Z',
        exitCode: 1,
        message: 'failed',
        state: 'failed',
        taskId: 'task-1',
        updatedAt: '2026-04-07T18:05:05.000000000Z',
      },
    ]);
  });

  it('reads failed migration job container logs via Portainer', async () => {
    const fetchMock = vi.fn(async () => new Response('line-a\nline-b', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      readRemoteJobLogTail(
        {
          commandExists: () => false,
          rootDir: '/repo',
          runCapture: () => '',
        },
        {
          PORTAINER_ENDPOINT_ID: '7',
          QUANTUM_API_KEY: 'key-1',
          QUANTUM_HOST: 'https://quantum.example',
        },
        {
          containerId: 'container-1',
          quantumEndpoint: 'sva',
          serviceId: 'service-1',
        },
      ),
    ).resolves.toBe('line-a\nline-b');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://quantum.example/api/endpoints/7/docker/containers/container-1/logs?stdout=1&stderr=1&tail=200',
      expect.objectContaining({ headers: { 'X-API-Key': 'key-1' } }),
    );

    vi.unstubAllGlobals();
  });

  it('falls back from container logs to service logs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404 }))
      .mockResolvedValueOnce(new Response('service-log', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      readRemoteJobLogTail(
        {
          commandExists: () => false,
          rootDir: '/repo',
          runCapture: () => '',
        },
        {
          PORTAINER_ENDPOINT_ID: '7',
          QUANTUM_API_KEY: 'key-1',
        },
        {
          containerId: 'container-1',
          quantumEndpoint: 'sva',
          serviceId: 'service-1',
        },
      ),
    ).resolves.toBe('service-log');

    vi.unstubAllGlobals();
  });

  it('surfaces Portainer text errors for missing api keys and http failures', async () => {
    await expect(
      fetchPortainerDockerText(
        {
          commandExists: () => false,
          runCapture: () => '',
        },
        { PORTAINER_ENDPOINT_ID: '7', QUANTUM_API_KEY: '' },
        { quantumEndpoint: 'sva', resourcePath: 'services/service-1/logs' },
      ),
    ).rejects.toThrow('QUANTUM_API_KEY fehlt');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 403 })));
    await expect(
      fetchPortainerDockerText(
        {
          commandExists: () => false,
          runCapture: () => '',
        },
        { PORTAINER_ENDPOINT_ID: '7', QUANTUM_API_KEY: 'key-1' },
        { quantumEndpoint: 'sva', resourcePath: 'services/service-1/logs' },
      ),
    ).rejects.toThrow('antwortet mit 403');
    vi.unstubAllGlobals();
  });

  it('includes container logs and task snapshots in failed migration job errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('goose failed', { status: 200 })));
    const runCalls: string[] = [];
    const deps = {
      commandExists: () => true,
      rootDir: process.cwd(),
      run: (_rootDir: string, commandName: string, args: readonly string[]) => {
        runCalls.push([commandName, ...args].join(' '));
      },
      runCapture: (_rootDir: string, commandName: string) =>
        commandName === 'docker'
          ? JSON.stringify({
              services: {
                migrate: {
                  image: 'ghcr.io/example/app@sha256:abc',
                },
              },
            })
          : '',
      runCaptureDetailed: () => ({
        output: [],
        pid: 1,
        signal: null,
        status: 0,
        stderr: '',
        stdout: JSON.stringify({
          stacks: {
            'studio-migrate-20260407': [
              {
                tasks: [
                  {
                    CreatedAt: '2026-04-07T18:05:00.000000000Z',
                    ID: 'task-1',
                    ServiceID: 'service-1',
                    Status: {
                      ContainerStatus: { ContainerID: 'container-1', ExitCode: 1 },
                      Message: 'goose exited',
                      State: 'failed',
                      Timestamp: '2026-04-07T18:05:05.000000000Z',
                    },
                  },
                ],
              },
            ],
          },
        }),
      }),
      spawnBackground: (() => ({ kill: () => undefined, pid: 1 })) as never,
      wait: async () => undefined,
    };

    await expect(
      runMigrationJobAgainstAcceptance(
        deps,
        {
          PORTAINER_ENDPOINT_ID: '7',
          QUANTUM_API_KEY: 'key-1',
          SVA_MIGRATION_JOB_STACK_NAME: 'studio-migrate-20260407',
        },
        {
          internalNetworkName: 'studio_default',
          quantumEndpoint: 'sva',
          remoteComposeFile: 'docker-compose.yml',
          reportId: '20260407',
          runtimeProfile: 'studio',
          sourceStackName: 'studio',
        },
      ),
    ).rejects.toThrow(/containerLogs:\ngoose failed[\s\S]*taskSnapshot:/u);

    expect(
      runCalls.some(
        (call) => call.includes('stacks remove') && call.includes('--stack studio-migrate-20260407'),
      ),
    ).toBe(true);
    vi.unstubAllGlobals();
  });

  it('keeps failed migration job stacks when the diagnostic flag is set', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
    const runCalls: string[] = [];
    const deps = {
      commandExists: () => true,
      rootDir: process.cwd(),
      run: (_rootDir: string, commandName: string, args: readonly string[]) => {
        runCalls.push([commandName, ...args].join(' '));
      },
      runCapture: (_rootDir: string, commandName: string) =>
        commandName === 'docker'
          ? JSON.stringify({
              services: {
                migrate: {
                  image: 'ghcr.io/example/app@sha256:abc',
                },
              },
            })
          : '',
      runCaptureDetailed: () => ({
        output: [],
        pid: 1,
        signal: null,
        status: 0,
        stderr: '',
        stdout:
          JSON.stringify({
            stacks: {
              'studio-migrate-20260407': [
                {
                  tasks: [
                    {
                      ID: 'task-1',
                      Status: { ContainerStatus: { ExitCode: 1 }, State: 'failed' },
                    },
                  ],
                },
              ],
            },
          }),
      }),
      spawnBackground: (() => ({ kill: () => undefined, pid: 1 })) as never,
      wait: async () => undefined,
    };

    await expect(
      runMigrationJobAgainstAcceptance(
        deps,
        {
          PORTAINER_ENDPOINT_ID: '7',
          QUANTUM_API_KEY: 'key-1',
          SVA_MIGRATION_JOB_KEEP_FAILED_STACK: 'true',
          SVA_MIGRATION_JOB_STACK_NAME: 'studio-migrate-20260407',
        },
        {
          internalNetworkName: 'studio_default',
          quantumEndpoint: 'sva',
          remoteComposeFile: 'docker-compose.yml',
          reportId: '20260407',
          runtimeProfile: 'studio',
          sourceStackName: 'studio',
        },
      ),
    ).rejects.toThrow('ist fehlgeschlagen');

    expect(runCalls.some((call) => call.includes('rm studio-migrate-20260407'))).toBe(false);
    vi.unstubAllGlobals();
  });
});
