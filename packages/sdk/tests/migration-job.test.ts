import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  buildMigrationJobComposeDocument,
  collectQuantumTaskSnapshots,
  extractQuantumJsonPayload,
  getMigrationJobTerminalState,
  selectLatestMigrationTask,
} from '../../../scripts/ops/runtime/migration-job.ts';

describe('migration-job runtime helpers', () => {
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
});
