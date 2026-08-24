import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/sync-user-documentation.yml'),
  'utf8'
);

describe('user documentation sync workflow', () => {
  it('runs only after relevant main pushes or an explicit manual dispatch', () => {
    expect(workflow).toContain("- main");
    expect(workflow).toContain("- 'docs/user-documentation/page-catalog.json'");
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).not.toContain('schedule:');
  });

  it('dispatches the exact Studio commit with a dedicated credential', () => {
    expect(workflow).toContain(
      'GH_TOKEN: ${{ secrets.DOCUMENTATION_REPOSITORY_DISPATCH_TOKEN }}'
    );
    expect(workflow).toContain('--arg studio_sha "$GITHUB_SHA"');
    expect(workflow).toContain('studio-documentation-catalog-updated');
    expect(workflow).toContain(
      'repos/smart-village-solutions/sva-studio-user-documentation/dispatches'
    );
  });

  it('has no write permission in the Studio repository', () => {
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pull-requests: write');
  });
});
