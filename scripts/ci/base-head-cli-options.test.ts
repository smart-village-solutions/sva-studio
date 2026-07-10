import { describe, expect, it } from 'vitest';
import { parseBaseHeadCliOptions } from './base-head-cli-options.ts';

describe('parseBaseHeadCliOptions', () => {
  it('uses the PR gate defaults', () => {
    expect(parseBaseHeadCliOptions([])).toEqual({ base: 'origin/main', head: 'HEAD' });
  });

  it('reads base and head regardless of their order', () => {
    expect(parseBaseHeadCliOptions(['--head', 'feature', '--base', 'main'])).toEqual({
      base: 'main',
      head: 'feature',
    });
  });

  it.each(['--base', '--head'])('rejects a missing value for %s', (option) => {
    expect(() => parseBaseHeadCliOptions([option])).toThrow(`Fehlender Wert für ${option}`);
  });
});
