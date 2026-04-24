import { describe, expect, it, vi } from 'vitest';

const commandExistsMock = vi.hoisted(() => vi.fn<(...args: readonly unknown[]) => boolean>(() => true));
const runQuantumExecMock = vi.hoisted(() => vi.fn<(...args: readonly unknown[]) => string>());

vi.mock('./runtime/process.ts', async () => {
  const actual = await vi.importActual<typeof import('./runtime/process.ts')>('./runtime/process.ts');
  return {
    ...actual,
    commandExists: (...args: Parameters<typeof actual.commandExists>) => commandExistsMock(...args),
    runQuantumExec: (...args: Parameters<typeof actual.runQuantumExec>) => runQuantumExecMock(...args),
  };
});

import { resolveTenantRuntimeTargets } from './runtime-env.ts';

describe('resolveTenantRuntimeTargets remote registry scope', () => {
  it('parses registry-backed remote tenant targets from the marked SQL payload', async () => {
    runQuantumExecMock.mockReturnValue(`
noise before
__SVA_DOCTOR_JSON___START
[{"instanceId":"hb-demo","host":"hb-demo.studio.example.org","authRealm":"saas-hb-demo"}]
__SVA_DOCTOR_JSON___END
noise after
`);

    const resolution = await resolveTenantRuntimeTargets('studio', {
      IAM_DATABASE_URL: 'postgres://db',
      REDIS_URL: 'redis://cache',
      SVA_AUTH_CLIENT_SECRET: 'secret',
      SVA_AUTH_STATE_SECRET: 'state',
      SVA_AUTH_REDIRECT_URI: 'https://studio.example.org/auth/callback',
      SVA_AUTH_POST_LOGOUT_REDIRECT_URI: 'https://studio.example.org/',
      KEYCLOAK_ADMIN_BASE_URL: 'https://keycloak.example.org',
      KEYCLOAK_ADMIN_REALM: 'master',
      KEYCLOAK_ADMIN_CLIENT_ID: 'admin-cli',
      KEYCLOAK_ADMIN_CLIENT_SECRET: 'admin-secret',
      SVA_PARENT_DOMAIN: 'studio.example.org',
      SVA_STACK_NAME: 'studio',
      QUANTUM_ENDPOINT: 'acceptance',
    });

    expect(commandExistsMock).toHaveBeenCalled();
    expect(runQuantumExecMock).toHaveBeenCalled();
    expect(resolution).toEqual({
      source: 'registry',
      targets: [
        {
          instanceId: 'hb-demo',
          host: 'hb-demo.studio.example.org',
          authRealm: 'saas-hb-demo',
        },
      ],
    });
  });
});
