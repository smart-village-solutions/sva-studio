import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.hoisted(() => vi.fn());
const stdoutWriteMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  spawnSync: spawnSyncMock,
}));

describe('runBindLocalUser', () => {
  beforeEach(() => {
    spawnSyncMock.mockReset();
    stdoutWriteMock.mockReset();
  });

  it('keeps dry-run execution sql non-mutating for instance memberships', async () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: '{"ok":true}',
      stderr: '',
    });

    vi.stubEnv('IAM_DATABASE_URL', 'postgres://iam:test@localhost:5432/iam');
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(stdoutWriteMock as never);
    const { runBindLocalUser } = await import('./bind-local-user.ts');

    const exitCode = runBindLocalUser([
      '--instance-id=instance-1',
      '--keycloak-subject=user-1',
      '--role-keys=system_admin',
      '--organization-ids=11111111-1111-1111-1111-111111111111',
      '--dry-run',
    ]);

    expect(exitCode).toBe(0);
    expect(stdoutWriteMock).toHaveBeenCalledWith('{"ok":true}\n');
    const sql = spawnSyncMock.mock.calls[0]?.[1]?.[4];
    expect(typeof sql).toBe('string');
    expect(sql).toContain('SELECT NULL::uuid AS account_id WHERE FALSE');
    expect(sql).not.toContain('INSERT INTO iam.instance_memberships');

    stdoutSpy.mockRestore();
  });
});
