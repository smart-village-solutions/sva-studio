import { describe, expect, it } from 'vitest';

import { parseStudioInstanceAuditOptions } from './options.ts';

describe('parseStudioInstanceAuditOptions', () => {
  it('uses docs/reports as default output directory', () => {
    expect(parseStudioInstanceAuditOptions([], '/repo')).toEqual({
      outputDir: '/repo/docs/reports',
    });
  });

  it('prefers an explicit output directory', () => {
    expect(parseStudioInstanceAuditOptions(['--output-dir', '/tmp/reports'], '/repo')).toEqual({
      outputDir: '/tmp/reports',
    });
  });
});
