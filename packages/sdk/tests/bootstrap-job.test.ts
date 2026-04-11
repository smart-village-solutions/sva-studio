import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildBootstrapJobComposeDocument } from '../../../scripts/ops/runtime/bootstrap-job.ts';

describe('bootstrap-job runtime helpers', () => {
  it('derives a dedicated one-off bootstrap compose from the rendered stack compose', () => {
    const result = buildBootstrapJobComposeDocument(
      {
        services: {
          app: {
            image: 'ghcr.io/example/app@sha256:abc',
          },
          bootstrap: {
            command: null,
            image: 'ghcr.io/example/app@sha256:abc',
            entrypoint: ['./bootstrap-entrypoint.sh'],
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
            },
            networks: ['internal'],
          },
        },
      },
      {
        internalNetworkName: 'studio_default',
        jobStackName: 'studio-bootstrap-20260407',
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
        bootstrap: {
          image: 'ghcr.io/example/app@sha256:abc',
          entrypoint: ['./bootstrap-entrypoint.sh'],
          environment: {
            POSTGRES_DB: 'sva_studio',
            POSTGRES_HOST: 'studio_postgres',
            SVA_BOOTSTRAP_JOB_STACK: 'studio-bootstrap-20260407',
            SVA_BOOTSTRAP_TARGET_STACK: 'studio',
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

  it('can scale the bootstrap service back to zero without changing app networks', () => {
    const result = buildBootstrapJobComposeDocument(
      {
        name: 'studio',
        networks: {
          internal: {
            driver: 'overlay',
          },
          public: {
            external: true,
          },
        },
        services: {
          app: {
            networks: ['internal', 'public'],
          },
          bootstrap: {
            command: null,
            image: 'ghcr.io/example/app@sha256:abc',
            deploy: {
              replicas: 1,
            },
            networks: ['internal'],
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
        bootstrap: {
          image: 'ghcr.io/example/app@sha256:abc',
          environment: {
            POSTGRES_HOST: 'studio_postgres',
            SVA_BOOTSTRAP_JOB_STACK: 'studio',
            SVA_BOOTSTRAP_TARGET_STACK: 'studio',
          },
          deploy: {
            replicas: 0,
            restart_policy: {
              condition: 'none',
            },
          },
          networks: ['internal'],
        },
      },
    });
  });
});
