import { describe, expect, it, vi } from 'vitest';
import { createInstanceRegistryRepository } from './index.js';
import { mapInstance } from './repository-mappers.js';
import type { InstanceListRow } from './repository-types.js';

describe('tenant login MFA persistence', () => {
  it('defaults unverified instances to optional pending without claiming application', () => {
    expect(mapInstance({} as InstanceListRow).loginMfaPolicy).toEqual({
      desiredMode: 'optional',
      appliedMode: null,
      status: 'pending',
    });
  });
  it('preserves last verified mode when the latest run fails', () => {
    expect(
      mapInstance({
        login_mfa_desired_mode: 'required',
        login_mfa_applied_mode: 'optional',
        login_mfa_revision: 2,
        login_mfa_applied_revision: 1,
        login_mfa_run_status: 'failed',
      } as InstanceListRow).loginMfaPolicy
    ).toEqual({ desiredMode: 'required', appliedMode: 'optional', status: 'failed' });
  });
  it('fences superseded completions by revision and linked run', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const result = await createInstanceRegistryRepository({ execute }).verifyLoginMfaPolicy({
      instanceId: 'a',
      revision: 3,
      mode: 'required',
      runId: 'old',
    });
    expect(result).toBe(false);
    expect(execute.mock.calls[0][0].text).toMatch(/login_mfa_revision = \$2/);
    expect(execute.mock.calls[0][0].text).toMatch(/login_mfa_run_id = \$4/);
  });
});
