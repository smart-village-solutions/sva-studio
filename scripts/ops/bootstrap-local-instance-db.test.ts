import { describe, expect, it, vi } from 'vitest';

import { bootstrapAppUser, importSchema, recreateDatabase } from './bootstrap-local-instance-db/database-bootstrap.ts';
import { sqlIdentifier, sqlLiteral } from './bootstrap-local-instance-db/docker-psql.ts';
import { fetchKeycloakUsers } from './bootstrap-local-instance-db/keycloak-sync.ts';
import {
  BootstrapLocalInstanceDbCliError,
  parseBootstrapLocalInstanceDbArgs,
  renderUsage,
} from './bootstrap-local-instance-db/parse-options.ts';
import { summarizeTargetState } from './bootstrap-local-instance-db/summary.ts';
import {
  assertBootstrapLocalInstanceDbApproved,
  buildBootstrapLocalInstanceDbApprovalToken,
  runBootstrapLocalInstanceDb,
} from './bootstrap-local-instance-db.ts';

describe('parseBootstrapLocalInstanceDbArgs', () => {
  it('parses required args and defaults', () => {
    expect(
      parseBootstrapLocalInstanceDbArgs([
        '--target-instance-id=hb-demo',
        '--target-realm=saas-hb-demo',
        '--keycloak-admin-client-id=sva-studio-iam-service',
        '--keycloak-admin-client-secret=secret',
        '--target-db-container=sva-studio-postgres-hb',
      ])
    ).toMatchObject({
      pageSize: 200,
      sourceDbContainer: 'sva-studio-postgres',
      targetDisplayName: 'hb-demo',
      targetInstanceId: 'hb-demo',
    });
  });

  it('rejects invalid numeric values', () => {
    expect(() =>
      parseBootstrapLocalInstanceDbArgs([
        '--target-instance-id=hb-demo',
        '--target-realm=saas-hb-demo',
        '--keycloak-admin-client-id=sva-studio-iam-service',
        '--keycloak-admin-client-secret=secret',
        '--target-db-container=sva-studio-postgres-hb',
        '--page-size=0',
      ])
    ).toThrow('--page-size');
  });

  it('renders usage text for required options', () => {
    expect(renderUsage()).toContain('--target-instance-id');
  });

  it('parses the dangerous approval token', () => {
    expect(
      parseBootstrapLocalInstanceDbArgs([
        '--target-instance-id=hb-demo',
        '--target-realm=saas-hb-demo',
        '--keycloak-admin-client-id=sva-studio-iam-service',
        '--keycloak-admin-client-secret=secret',
        '--target-db-container=sva-studio-postgres-hb',
        '--approve-dangerous=bootstrap-local-instance-db:hb-demo',
      ]),
    ).toMatchObject({
      approvalToken: 'bootstrap-local-instance-db:hb-demo',
    });
  });
});

describe('bootstrap dangerous approval', () => {
  it('builds the canonical approval token', () => {
    expect(buildBootstrapLocalInstanceDbApprovalToken('hb-demo')).toBe('bootstrap-local-instance-db:hb-demo');
  });

  it('rejects missing approval for bootstrap mutations', () => {
    expect(() =>
      assertBootstrapLocalInstanceDbApproved({
        approvalToken: undefined,
        targetInstanceId: 'hb-demo',
      }),
    ).toThrow('--approve-dangerous=bootstrap-local-instance-db:hb-demo');
  });

  it('accepts the matching approval token', () => {
    expect(() =>
      assertBootstrapLocalInstanceDbApproved({
        approvalToken: 'bootstrap-local-instance-db:hb-demo',
        targetInstanceId: 'hb-demo',
      }),
    ).not.toThrow();
  });
});

describe('sql helpers', () => {
  it('quotes SQL literals and identifiers', () => {
    expect(sqlLiteral("o'hara")).toBe("'o''hara'");
    expect(sqlIdentifier('my"user')).toBe('"my""user"');
  });
});

describe('database bootstrap helpers', () => {
  const options = parseBootstrapLocalInstanceDbArgs([
    '--target-instance-id=hb-demo',
    '--target-realm=saas-hb-demo',
    '--keycloak-admin-client-id=sva-studio-iam-service',
    '--keycloak-admin-client-secret=secret',
    '--target-db-container=sva-studio-postgres-hb',
  ]);

  it('recreates the target database via docker', () => {
    const run = vi.fn(() => '');
    recreateDatabase(options, run, vi.fn());
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledWith(
      'docker',
      ['exec', '-i', 'sva-studio-postgres-hb', 'dropdb', '-U', 'sva', '--if-exists', 'sva_studio']
    );
    expect(run).toHaveBeenNthCalledWith(
      2,
      'docker',
      ['exec', '-i', 'sva-studio-postgres-hb', 'createdb', '-U', 'sva', 'sva_studio']
    );
  });

  it('imports schema from the source database', () => {
    const run = vi.fn<(...args: unknown[]) => string>()
      .mockReturnValueOnce('schema')
      .mockReturnValueOnce('');
    importSchema(options, run, vi.fn());
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]?.[2]).toBe('schema');
  });

  it('bootstraps the app user with grants', () => {
    const dockerPsql = vi.fn(() => '');
    bootstrapAppUser(options, dockerPsql, vi.fn());
    expect(dockerPsql).toHaveBeenCalledWith(
      options.targetDbContainer,
      options.targetDbUser,
      options.targetDbName,
      expect.stringContaining('GRANT iam_app')
    );
  });
});

describe('fetchKeycloakUsers', () => {
  const options = parseBootstrapLocalInstanceDbArgs([
    '--target-instance-id=hb-demo',
    '--target-realm=saas-hb-demo',
    '--keycloak-admin-client-id=sva-studio-iam-service',
    '--keycloak-admin-client-secret=secret',
    '--target-db-container=sva-studio-postgres-hb',
    '--page-size=2',
  ]);

  it('pages through user results and deduplicates disabled entries', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'a' }, { id: 'b', enabled: false }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'a' }, { id: 'c' }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    await expect(fetchKeycloakUsers(options, vi.fn(), fetchImpl)).resolves.toEqual([{ id: 'a' }, { id: 'c' }]);
  });
});

describe('summarizeTargetState', () => {
  it('renders the target state summary', () => {
    const options = parseBootstrapLocalInstanceDbArgs([
      '--target-instance-id=hb-demo',
      '--target-realm=saas-hb-demo',
      '--keycloak-admin-client-id=sva-studio-iam-service',
      '--keycloak-admin-client-secret=secret',
      '--target-db-container=sva-studio-postgres-hb',
    ]);
    const writes: string[] = [];
    summarizeTargetState(
      options,
      () => 'accounts\t1\nmemberships\t2',
      (chunk) => writes.push(chunk)
    );
    expect(writes.join('')).toContain('- accounts: 1');
    expect(writes.join('')).toContain('- memberships: 2');
  });
});

describe('runBootstrapLocalInstanceDb', () => {
  it('orchestrates all phases and writes the completion message', async () => {
    const run = vi
      .fn<(...args: unknown[]) => string>()
      .mockReturnValueOnce('schema')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('dump')
      .mockReturnValueOnce('')
      .mockReturnValueOnce('');
    const writes: string[] = [];
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );

    await expect(
      runBootstrapLocalInstanceDb(
        [
          '--target-instance-id=hb-demo',
          '--target-realm=saas-hb-demo',
          '--keycloak-admin-client-id=sva-studio-iam-service',
          '--keycloak-admin-client-secret=secret',
          '--target-db-container=sva-studio-postgres-hb',
          '--approve-dangerous=bootstrap-local-instance-db:hb-demo',
          '--create-db',
          '--import-schema',
        ],
        {
          dockerPsqlImpl: vi.fn(() => ''),
          dockerPsqlQuietImpl: vi
            .fn()
            .mockReturnValueOnce('Demo\t90\t365')
            .mockReturnValueOnce('accounts\t0\nmemberships\t0'),
          fetchImpl,
          logStepImpl: vi.fn(),
          runImpl: run,
          write: (chunk) => writes.push(chunk),
        }
      )
    ).resolves.toBe(0);

    expect(fetchImpl).toHaveBeenCalled();
    expect(writes.join('')).toContain('Fertig. Nächste Schritte');
  });

  it('returns usage exit code for missing required options', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await expect(runBootstrapLocalInstanceDb([])).resolves.toBe(2);
    stderrSpy.mockRestore();
  });

  it('fails early when the explicit dangerous approval token is missing', async () => {
    await expect(
      runBootstrapLocalInstanceDb(
        [
          '--target-instance-id=hb-demo',
          '--target-realm=saas-hb-demo',
          '--keycloak-admin-client-id=sva-studio-iam-service',
          '--keycloak-admin-client-secret=secret',
          '--target-db-container=sva-studio-postgres-hb',
        ],
        {
          dockerPsqlImpl: vi.fn(() => ''),
          dockerPsqlQuietImpl: vi.fn(),
          fetchImpl: vi.fn<typeof fetch>(),
          logStepImpl: vi.fn(),
          runImpl: vi.fn(() => ''),
          write: vi.fn(),
        },
      ),
    ).rejects.toThrow('--approve-dangerous=bootstrap-local-instance-db:hb-demo');
  });

  it('throws structured cli errors for missing required options', () => {
    expect(() => parseBootstrapLocalInstanceDbArgs([])).toThrowError(BootstrapLocalInstanceDbCliError);
    expect(() => parseBootstrapLocalInstanceDbArgs([])).toThrowError(/Missing required option/);
  });
});
