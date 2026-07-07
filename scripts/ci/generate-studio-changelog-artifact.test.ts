import { describe, expect, it } from 'vitest';

import { assertRepositoryHistoryAvailable } from './generate-studio-changelog-artifact.ts';

describe('generate-studio-changelog-artifact', () => {
  it('accepts repositories with full git history', () => {
    expect(() =>
      assertRepositoryHistoryAvailable('/repo', (args) => {
        expect(args).toEqual(['-C', '/repo', 'rev-parse', '--is-shallow-repository']);
        return 'false\n';
      })
    ).not.toThrow();
  });

  it('fails closed for shallow repositories', () => {
    expect(() =>
      assertRepositoryHistoryAvailable('/repo', (args) => {
        expect(args).toEqual(['-C', '/repo', 'rev-parse', '--is-shallow-repository']);
        return 'true\n';
      })
    ).toThrow(/vollständige Git-Historie/u);
  });
});
