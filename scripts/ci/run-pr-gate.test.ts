import { describe, expect, it } from 'vitest';

import { buildCoverageGateCommand, formatDurationSummary } from './run-pr-gate.ts';

describe('run-pr-gate', () => {
  it('formats a readable duration summary for gates and slices', () => {
    expect(
      formatDurationSummary([
        { label: 'plugin-architecture-boundary', durationMs: 980 },
        { label: 'lint:affected', durationMs: 1_230 },
        { label: 'unit:app:routes', durationMs: 12_500 },
      ])
    ).toBe(
      ['- plugin-architecture-boundary: 0.98s', '- lint:affected: 1.23s', '- unit:app:routes: 12.50s'].join('\n')
    );
  });

  it('keeps full coverage regression checks unfiltered', () => {
    expect(buildCoverageGateCommand('full')).toBe('env COVERAGE_GATE_REQUIRE_SUMMARIES=1 pnpm coverage-gate');
  });
});
