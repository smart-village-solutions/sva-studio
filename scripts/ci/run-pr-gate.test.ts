import { describe, expect, it } from 'vitest';

import { formatDurationSummary } from './run-pr-gate.ts';

describe('run-pr-gate', () => {
  it('formats a readable duration summary for gates and slices', () => {
    expect(
      formatDurationSummary([
        { label: 'lint:affected', durationMs: 1_230 },
        { label: 'unit:app:routes', durationMs: 12_500 },
      ])
    ).toBe(['- lint:affected: 1.23s', '- unit:app:routes: 12.50s'].join('\n'));
  });
});
