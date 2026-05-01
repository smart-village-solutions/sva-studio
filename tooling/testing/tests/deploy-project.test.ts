import { describe, expect, it } from 'vitest';

import {
  assertComposeServiceIngressLabels,
  assertComposeServiceNetworks,
  buildQuantumDeployComposeDocument,
  extractComposeServiceContract,
} from '../../../scripts/ops/runtime/deploy-project.ts';

describe('deploy-project runtime helpers', () => {
  it('builds a deploy compose without the docker compose name shim', () => {
    expect(
      buildQuantumDeployComposeDocument({
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
            image: 'ghcr.io/example/app@sha256:abc',
            networks: {
              internal: null,
              public: null,
            },
            deploy: {
              resources: {
                limits: {
                  cpus: 1,
                },
              },
            },
          },
        },
      }),
    ).toEqual({
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
          image: 'ghcr.io/example/app@sha256:abc',
          networks: {
            internal: null,
            public: null,
          },
          deploy: {
            resources: {
              limits: {
                cpus: '1',
              },
            },
          },
        },
      },
    });
  });

  it('keeps network attachment nulls but drops unrelated null service fields', () => {
    expect(
      buildQuantumDeployComposeDocument({
        services: {
          bootstrap: {
            command: null,
            image: 'ghcr.io/example/app@sha256:def',
            networks: {
              internal: null,
            },
          },
        },
      }),
    ).toEqual({
      services: {
        bootstrap: {
          image: 'ghcr.io/example/app@sha256:def',
          networks: {
            internal: null,
          },
        },
      },
    });
  });

  it('extracts the app contract including deploy labels and required networks', () => {
    const contract = assertComposeServiceNetworks(
      {
        services: {
          app: {
            image: 'ghcr.io/example/app@sha256:abc',
            environment: {
              SVA_RUNTIME_PROFILE: 'studio',
            },
            networks: {
              internal: null,
              public: null,
            },
            deploy: {
              labels: {
                'traefik.enable': 'true',
              },
            },
          },
        },
      },
      'app',
      ['internal', 'public'],
    );

    expect(contract).toEqual({
      env: {
        SVA_RUNTIME_PROFILE: 'studio',
      },
      image: 'ghcr.io/example/app@sha256:abc',
      labels: {
        'traefik.enable': 'true',
      },
      networks: ['internal', 'public'],
    });
  });

  it('fails fast when the rendered app contract misses the public network', () => {
    expect(() =>
      assertComposeServiceNetworks(
        {
          services: {
            app: {
              image: 'ghcr.io/example/app@sha256:abc',
              networks: {
                internal: null,
              },
            },
          },
        },
        'app',
        ['internal', 'public'],
      ),
    ).toThrow(/public/);
  });

  it('fails fast when the rendered app contract misses required ingress labels', () => {
    expect(() =>
      assertComposeServiceIngressLabels(
        {
          services: {
            app: {
              image: 'ghcr.io/example/app@sha256:abc',
              networks: {
                internal: null,
                public: null,
              },
              deploy: {
                labels: {
                  'traefik.enable': 'true',
                },
              },
            },
          },
        },
        'app',
      ),
    ).toThrow(/traefik\.docker\.network/);
  });

  it('fails fast when the rendered app contract has no ingress routing labels', () => {
    expect(() =>
      assertComposeServiceIngressLabels(
        {
          services: {
            app: {
              image: 'ghcr.io/example/app@sha256:abc',
              networks: {
                internal: null,
                public: null,
              },
              deploy: {
                labels: {
                  'traefik.enable': 'true',
                  'traefik.docker.network': 'public',
                },
              },
            },
          },
        },
        'app',
      ),
    ).toThrow(/Traefik-Routing-Labels/);
  });

  it('returns null for missing services', () => {
    expect(extractComposeServiceContract({ services: {} }, 'app')).toBeNull();
  });
});
