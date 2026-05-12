import { describe, expect, it } from 'vitest';

import {
  classifyPrScope,
  isNonCodeRelevantPath,
  resolveChangedFiles,
  type PrScopeDecision,
} from './pr-scope.ts';

const expectDecision = (
  decision: PrScopeDecision,
  expected: Partial<PrScopeDecision>
): void => {
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
      e2eMode: 'skip',
    });
  });

  it('keeps ordinary package changes on affected-only gates', () => {
    const decision = classifyPrScope([
      'packages/plugin-news/src/index.ts',
      'packages/plugin-news/tests/news.api.test.ts',
    ]);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'affected',
      integrationMode: 'skip',
      e2eMode: 'skip',
      appBuildMode: 'skip',
    });
  });

  it('escalates root tooling changes to full quality and coverage gates', () => {
    const decision = classifyPrScope(['pnpm-lock.yaml']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'full',
      coverageMode: 'full',
      integrationMode: 'skip',
      e2eMode: 'skip',
    });
    expect(decision.escalationReasons).toContain('pnpm-lock.yaml');
  });

  it('runs affected integration and e2e gates for app and routing changes', () => {
    const decision = classifyPrScope([
      'apps/sva-studio-react/src/routes/index.tsx',
      'packages/routing/src/auth.routes.ts',
    ]);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'affected',
      coverageMode: 'affected',
      integrationMode: 'affected',
      e2eMode: 'affected',
      appBuildMode: 'affected',
    });
  });

  it('escalates full quality and build gates for root build-critical files without forcing runtime smoke checks', () => {
    const decision = classifyPrScope(['vitest.config.ts']);

    expectDecision(decision, {
      codeRelevant: true,
      qualityGateMode: 'full',
      coverageMode: 'full',
      integrationMode: 'skip',
      e2eMode: 'skip',
      appBuildMode: 'full',
    });
  });

  it('falls back to two-dot diff when no merge base is available', () => {
    let invocationCount = 0;

    const changedFiles = resolveChangedFiles('origin/main', 'HEAD', (args) => {
      invocationCount += 1;
      const diffRange = args.at(-1);

      if (diffRange === 'origin/main...HEAD') {
        throw new Error('fatal: origin/main...HEAD: no merge base');
      }

      expect(diffRange).toBe('origin/main..HEAD');
      return 'packages/core/src/index.ts\napps/sva-studio-react/src/routes/index.tsx\n';
    });

    expect(invocationCount).toBe(2);
    expect(changedFiles).toEqual([
      'packages/core/src/index.ts',
      'apps/sva-studio-react/src/routes/index.tsx',
    ]);
  });
});
