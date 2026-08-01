import { describe, expect, it } from 'vitest';

import { renderRestoreStack } from './render-restore-stack.ts';

const source = JSON.stringify({
  services: {
    app: { image: 'example/app@sha256:test', deploy: { replicas: 1 } },
    provisioner: { image: 'example/app@sha256:test', deploy: { replicas: 1 } },
    postgres: { image: 'postgres:17', deploy: { replicas: 1 } },
  },
});

describe('restore maintenance stack rendering', () => {
  it('stops only database clients and keeps PostgreSQL running', () => {
    const result = JSON.parse(renderRestoreStack(source, 'stopped')) as {
      services: Record<string, { deploy: { replicas: number } }>;
    };
    expect(result.services.app.deploy.replicas).toBe(0);
    expect(result.services.provisioner.deploy.replicas).toBe(0);
    expect(result.services.postgres.deploy.replicas).toBe(1);
  });

  it('restores the normal application replica contract', () => {
    const result = JSON.parse(renderRestoreStack(source, 'running')) as {
      services: Record<string, { deploy: { replicas: number } }>;
    };
    expect(result.services.app.deploy.replicas).toBe(1);
    expect(result.services.provisioner.deploy.replicas).toBe(1);
  });

  it('fails closed for incomplete or non-singleton database stacks', () => {
    expect(() => renderRestoreStack(JSON.stringify({ services: {} }), 'stopped')).toThrow();
    expect(() =>
      renderRestoreStack(
        JSON.stringify({
          services: {
            app: { deploy: { replicas: 1 } },
            provisioner: { deploy: { replicas: 1 } },
            postgres: { deploy: { replicas: 2 } },
          },
        }),
        'stopped'
      )
    ).toThrow();
  });
});
