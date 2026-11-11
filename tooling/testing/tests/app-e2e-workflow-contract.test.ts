import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../../.github/workflows/app-e2e.yml'),
  'utf8'
);
const playwrightConfig = readFileSync(
  resolve(import.meta.dirname, '../../../apps/sva-studio-react/playwright.config.ts'),
  'utf8'
);
const prGate = readFileSync(
  resolve(import.meta.dirname, '../../../scripts/ci/run-pr-gate.ts'),
  'utf8'
);
const crossBrowserFirefoxSpec = resolve(
  import.meta.dirname,
  '../../../apps/sva-studio-react/e2e/real-auth.cross-browser.spec.ts'
);

describe('App E2E workflow contract', () => {
  it('partitions one complete uncached suite across four isolated runners, never PRs', () => {
    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).not.toContain('pr-scope');
    expect(workflow).not.toMatch(/paths(?:-ignore)?:/u);
    expect(workflow).not.toContain('e2e_mode');
    expect(workflow.match(/sva-studio-react:test:e2e/gu)).toHaveLength(1);
    expect(workflow).toContain('sva-studio-react:test:e2e --skipNxCache');
    expect(workflow).toContain('shard: [1, 2, 3, 4]');
    expect(workflow).toContain('fail-fast: false');
    expect(workflow).toContain('--shard=${{ matrix.shard }}/4');
    expect(playwrightConfig).toContain('workers: 1');
    expect(workflow).toContain('--workers=1');
    expect(workflow).toContain('Inventory complete E2E selection');
    expect(prGate).not.toContain('test:e2e');
  });

  it('discovers the inventory after Nx builds runtime dependencies, including failed test runs', () => {
    const execution = workflow.indexOf('name: Run complete app E2E suite uncached');
    const inventory = workflow.indexOf('name: Inventory complete E2E selection');
    const writer = workflow.indexOf('name: Write source-bound E2E shard evidence');

    expect(execution).toBeGreaterThanOrEqual(0);
    expect(inventory).toBeGreaterThan(execution);
    expect(writer).toBeGreaterThan(inventory);
    expect(workflow).toContain('name: Inventory complete E2E selection\n        if: always()');
  });

  it('keeps canonical main deterministic and diagnostics explicitly retryable', () => {
    expect(workflow).toContain("PLAYWRIGHT_MAX_FAILURES: '0'");
    expect(workflow).toContain(
      "APP_E2E_ALLOW_RETRY: ${{ github.event_name != 'push' && inputs.mode != 'hotfix' && 'true' || 'false' }}"
    );
    expect(playwrightConfig).toContain(
      "process.env.CI && process.env.APP_E2E_ALLOW_RETRY === 'true' ? 1 : 0"
    );
    expect(playwrightConfig).toContain("trace: 'retain-on-failure'");
    expect(playwrightConfig).toContain("screenshot: 'only-on-failure'");
  });

  it('installs locked Chromium using runner libraries without an APT mirror mutation', () => {
    expect(workflow).toContain(
      'run: pnpm --filter sva-studio-react exec playwright install chromium\n'
    );
    expect(workflow).not.toContain('playwright install --with-deps');
    expect(workflow).not.toContain('/etc/apt/apt-mirrors.txt');
    expect(workflow).not.toMatch(/playwright install[^\n]*firefox/u);
    expect(playwrightConfig).not.toContain('firefox-smoke');
    expect(playwrightConfig).not.toContain('PLAYWRIGHT_ENABLE_FIREFOX_SMOKE');
    expect(existsSync(crossBrowserFirefoxSpec)).toBe(false);
  });

  it('retains diagnostics and finalizes the terminal job result independently', () => {
    const setupNode = workflow.indexOf('uses: actions/setup-node@v6');
    const firstTypeScriptController = workflow.indexOf('node --experimental-strip-types');

    expect(workflow).toContain(
      'name: app-e2e-report-${{ matrix.shard }}-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(workflow).toContain('apps/sva-studio-react/playwright-report');
    expect(workflow).toContain('apps/sva-studio-react/test-results');
    expect(workflow).toMatch(/evidence:\n[\s\S]*needs: e2e\n\s+if: always\(\)/u);
    expect(workflow).toContain('APP_E2E_RESULT: ${{ needs.e2e.result }}');
    expect(workflow).toContain('APP_E2E_SHARD_DIRECTORY: artifacts/app-e2e-shards');
    expect(workflow).toContain('pattern: app-e2e-shard-*-${{ github.run_id }}');
    expect(workflow).toContain('if-no-files-found: error');
    expect(workflow).toContain('name: App E2E\n    needs: e2e');
    expect(workflow).toContain(
      'name: app-e2e-evidence-${{ github.run_id }}-${{ github.run_attempt }}'
    );
    expect(workflow).toContain(
      'run: node --experimental-strip-types scripts/ci/write-app-e2e-evidence.ts'
    );
    expect(workflow).toMatch(
      /uses: actions\/setup-node@v6\n\s+with:\n\s+node-version-file: \.nvmrc/u
    );
    expect(setupNode).toBeGreaterThanOrEqual(0);
    expect(firstTypeScriptController).toBeGreaterThan(setupNode);
    expect(workflow).not.toMatch(/run: node (?!--experimental-strip-types)[^\n]*\.ts/u);
  });
});
