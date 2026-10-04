import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertComplexityPolicy } from './complexity-policy.ts';

describe('complexity policy', () => {
  it('rejects a tracked fileLines finding', () => {
    const policy: unknown = JSON.parse(
      readFileSync('tooling/quality/complexity-policy.json', 'utf8')
    );
    assertComplexityPolicy(policy);

    expect(() =>
      assertComplexityPolicy({
        ...policy,
        trackedFindings: {
          ...policy.trackedFindings,
          'packages-default:packages/example/src/index.ts:fileLines': {
            ticketId: 'example',
            ticketSystem: 'github',
            status: 'open',
            summary: 'Example',
          },
        },
      })
    ).toThrow('fileLines findings cannot be tracked');
  });
});
