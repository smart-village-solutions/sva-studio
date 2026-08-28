import { describe, expect, it } from 'vitest';

import {
  classifyPrScope,
  isNonCodeRelevantPath,
  resolveChangedFiles,
  type PrScopeDecision,
} from './pr-scope.ts';
import { createPrScopeEvidence, parsePrScopeEvidence } from './pr-scope.cli.ts';
import { classifyLegacyWorkflowScope } from './legacy-pr-scope.ts';

const expectDecision = (decision: PrScopeDecision, expected: Partial<PrScopeDecision>): void => {
  expect(decision).toMatchObject(expected);
};

describe('pr-scope', () => {
  it('treats docs-only changes as non-code-relevant', () => {
    expect(isNonCodeRelevantPath('docs/development/testing-strategy.md')).toBe(true);
    expect(isNonCodeRelevantPath('.github/PULL_REQUEST_TEMPLATE.md')).toBe(true);

    const decision = classifyPrScope([
      'docs/development/testing-strategy.md',
      '.github/PULL_REQUEST_TEMPLATE.md',
    ]);

    expectDecision(decision, {
      codeRelevant: false,
      qualityGateMode: 'skip',
      coverageMode: 'skip',
      integrationMode: 'skip',
    });
  });

  it('keeps ordinary plugin package changes on affected-only quality gates while marking app build relevance', () => {
    const decision = classifyPrScope([
      'packages/plugin-news/src/index.ts',
      'packages/plugin-news/tests/news.api.test.ts',
    ]);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'skip',
      integrationMode: 'skip',
      appBuildMode: 'affected',
    });
  });

  it('classifies plugin waste-management tsx changes as app-build and accessibility relevant', () => {
    const decision = classifyPrScope([
      'packages/plugin-waste-management/src/waste-management.page.tsx',
    ]);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'skip',
      integrationMode: 'skip',
      a11yMode: 'affected',
      appBuildMode: 'affected',
    });
  });

  it('classifies plugin ui ts changes as app-build relevant', () => {
    const decision = classifyPrScope([
      'packages/plugin-waste-management/src/waste-management.scheduling.table-entries.ts',
    ]);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'skip',
      integrationMode: 'skip',
      a11yMode: 'skip',
      appBuildMode: 'affected',
    });
  });

  it('classifies plugin translation changes as app-build relevant', () => {
    const decision = classifyPrScope(['packages/plugin-news/src/plugin.translations.ts']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'skip',
      integrationMode: 'skip',
      appBuildMode: 'affected',
    });
  });

  it('classifies faq translation-only changes as app-build relevant', () => {
    const decision = classifyPrScope(['packages/plugin-faq/src/plugin.translations.ts']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'skip',
      integrationMode: 'skip',
      appBuildMode: 'affected',
    });
  });

  it('keeps docs-only pull requests as full no-op', () => {
    const decision = classifyPrScope(['docs/development/testing-coverage.md']);

    expectDecision(decision, {
      codeRelevant: false,
      qualityGateMode: 'skip',
      coverageMode: 'skip',
      integrationMode: 'skip',
      appBuildMode: 'skip',
      documentationCatalogMode: 'skip',
      dbSchemaMode: 'skip',
    });
  });

  it('keeps documentation catalog scope visible for its docs-owned snapshot', () => {
    const decision = classifyPrScope(['docs/user-documentation/page-catalog.json']);

    expectDecision(decision, {
      codeRelevant: false,
      qualityGateMode: 'skip',
      documentationCatalogMode: 'full',
      dbSchemaMode: 'skip',
    });
  });

  it('keeps DB schema scope visible for migration and documentation changes', () => {
    expectDecision(classifyPrScope(['packages/data/migrations/20260828_shadow.sql']), {
      dbSchemaMode: 'full',
    });
    expectDecision(classifyPrScope(['docs/development/studio-db-schema.md']), {
      codeRelevant: false,
      dbSchemaMode: 'full',
    });
  });

  it('creates and validates versioned Base-/Head-bound scope evidence', () => {
    const decision = classifyPrScope(['packages/core/src/index.ts']);
    const evidence = createPrScopeEvidence(decision, 'base-sha', 'head-sha');

    expect(parsePrScopeEvidence(evidence, 'base-sha', 'head-sha')).toEqual(evidence);
    expect(() => parsePrScopeEvidence(evidence, 'base-sha', 'other-head')).toThrow(/erwartet ist/u);
    expect(() =>
      parsePrScopeEvidence({ ...evidence, schemaVersion: 2 }, 'base-sha', 'head-sha')
    ).toThrow(/Schema-Version/u);
  });

  it('escalates root tooling changes to full quality and coverage gates', () => {
    const decision = classifyPrScope(['pnpm-lock.yaml']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'full',
      coverageMode: 'full',
      integrationMode: 'skip',
    });
    expect(decision.escalationReasons).toContain('pnpm-lock.yaml');
  });

  it('runs affected integration gates for app and routing changes', () => {
    const decision = classifyPrScope([
      'apps/sva-studio-react/src/routes/index.tsx',
      'packages/routing/src/auth.routes.ts',
    ]);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'skip',
      integrationMode: 'affected',
      a11yMode: 'affected',
      appBuildMode: 'affected',
    });
  });

  it('keeps backend-only changes out of the a11y gate', () => {
    const decision = classifyPrScope(['packages/auth-runtime/src/db.ts']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'skip',
      integrationMode: 'affected',
      a11yMode: 'skip',
      appBuildMode: 'skip',
    });
  });

  it('marks runtime-critical app server changes for runtime artifact verification', () => {
    const decision = classifyPrScope([
      'apps/sva-studio-react/src/server.ts',
      'apps/sva-studio-react/src/lib/auth.server.ts',
    ]);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      runtimeVerifyMode: 'affected',
    });
  });

  it('keeps ordinary ui-only app changes out of runtime artifact verification', () => {
    const decision = classifyPrScope(['apps/sva-studio-react/src/routes/index.tsx']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      runtimeVerifyMode: 'skip',
    });
  });

  it('escalates runtime artifact verification for runtime verify tooling changes', () => {
    const decision = classifyPrScope(['scripts/ci/verify-runtime-artifact.sh']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      runtimeVerifyMode: 'full',
    });
  });

  it('escalates full quality and build gates for root build-critical files without forcing runtime smoke checks', () => {
    const decision = classifyPrScope(['vitest.config.ts']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'full',
      coverageMode: 'full',
      integrationMode: 'skip',
      appBuildMode: 'full',
    });
  });

  it('escalates integration to full for gate workflow changes with current workflow names', () => {
    const decision = classifyPrScope(['.github/workflows/runtime-gates.yml']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'full',
      integrationMode: 'full',
      appBuildMode: 'full',
    });
  });

  it('keeps full coverage triggers independent from per-project regression scoping', () => {
    const decision = classifyPrScope([
      '.github/workflows/runtime-gates.yml',
      'apps/sva-studio-react/src/lib/studio-changelog.server.ts',
      'packages/plugin-events/tests/events.pages.test.tsx',
    ]);

    expectDecision(decision, {
      coverageMode: 'full',
    });
  });

  it('keeps workflow-only changes on affected quality gates', () => {
    const decision = classifyPrScope(['.github/workflows/quality-gates.yml']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'full',
      integrationMode: 'full',
      appBuildMode: 'full',
    });
    expect(decision.escalationReasons).toEqual([]);
  });

  it('keeps ci-script changes on affected quality gates and affected coverage', () => {
    const decision = classifyPrScope(['scripts/ci/run-pr-gate.ts']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'affected',
      integrationMode: 'full',
      appBuildMode: 'full',
    });
    expect(decision.escalationReasons).toEqual([]);
  });

  it('includes deleted files when resolving changed files', () => {
    const changedFiles = resolveChangedFiles('origin/main', 'HEAD', (args) => {
      expect(args).toEqual([
        'diff',
        '--name-status',
        '--find-renames',
        '--diff-filter=ACDMR',
        'origin/main...HEAD',
      ]);
      return 'D\tpackages/core/src/deleted.ts\n';
    });

    expect(changedFiles).toEqual(['packages/core/src/deleted.ts']);
  });

  it('preserves both paths of renamed files for scope classification', () => {
    const changedFiles = resolveChangedFiles('origin/main', 'HEAD', () =>
      [
        'R100\tpackages/data/migrations/0042_old.sql\tdocs/archive/0042_old.sql',
        'M\tpackages/core/src/index.ts',
      ].join('\n')
    );

    expect(changedFiles).toEqual([
      'packages/data/migrations/0042_old.sql',
      'docs/archive/0042_old.sql',
      'packages/core/src/index.ts',
    ]);
    expect(classifyPrScope(changedFiles).dbSchemaMode).toBe('full');
  });

  it('derives legacy workflow scope without using the centralized classifier', () => {
    const fixtures = [
      ['docs/development/testing-coverage.md'],
      ['packages/core/src/index.ts'],
      ['apps/sva-studio-react/src/routes/index.tsx'],
      ['apps/sva-studio-react/src/server.ts'],
      ['packages/data/migrations/0042_add_index.sql'],
      ['scripts/ci/pr-scope.ts'],
      ['pnpm-lock.yaml'],
    ];

    for (const files of fixtures) {
      expect(classifyLegacyWorkflowScope(files)).toEqual(classifyPrScope(files));
    }
  });

  it('falls back to two-dot diff when no merge base is available', () => {
    let invocationCount = 0;

    const changedFiles = resolveChangedFiles('origin/main', 'HEAD', (args) => {
      invocationCount += 1;
      const diffRange = args.at(-1);

      expect(args.slice(0, 4)).toEqual([
        'diff',
        '--name-status',
        '--find-renames',
        '--diff-filter=ACDMR',
      ]);

      if (diffRange === 'origin/main...HEAD') {
        throw new Error('fatal: origin/main...HEAD: no merge base');
      }

      expect(diffRange).toBe('origin/main..HEAD');
      return 'M\tpackages/core/src/index.ts\nA\tapps/sva-studio-react/src/routes/index.tsx\n';
    });

    expect(invocationCount).toBe(2);
    expect(changedFiles).toEqual([
      'packages/core/src/index.ts',
      'apps/sva-studio-react/src/routes/index.tsx',
    ]);
  });

  it('falls back to the base ref when partial clone diffing triggers a promisor auth fetch', () => {
    const previousBaseRef = process.env.GITHUB_BASE_REF;
    process.env.GITHUB_BASE_REF = 'main';

    try {
      const changedFiles = resolveChangedFiles(
        '3bf9958ef86bbbe2b841f9ab7c46ec8614d78580',
        'HEAD',
        (args) => {
          const diffRange = args.at(-1);

          if (diffRange === '3bf9958ef86bbbe2b841f9ab7c46ec8614d78580...HEAD') {
            throw new Error(
              "fatal: could not read Username for 'https://github.com': No such device or address\n" +
                'fatal: could not fetch c24de8f97e2c4fe0da0bc39c85ad66b253fc0528 from promisor remote'
            );
          }

          expect(diffRange).toBe('origin/main...HEAD');
          return 'M\tapps/sva-studio-react/src/routes/index.tsx\n';
        }
      );

      expect(changedFiles).toEqual(['apps/sva-studio-react/src/routes/index.tsx']);
    } finally {
      process.env.GITHUB_BASE_REF = previousBaseRef;
    }
  });
});
