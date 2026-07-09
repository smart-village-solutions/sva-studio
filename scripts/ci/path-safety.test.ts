import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { isCliEntrypoint, resolvePathFromBase, resolvePathWithin } from './path-safety.js';

describe('path-safety', () => {
  it('resolves relative paths from an explicit base directory', () => {
    const baseDir = path.join(os.tmpdir(), 'sva-path-safety-base');
    expect(resolvePathFromBase(baseDir, './reports/out.txt')).toBe(path.join(baseDir, 'reports', 'out.txt'));
  });

  it('rejects paths that escape the allowed base directory', () => {
    const baseDir = path.join(os.tmpdir(), 'sva-path-safety-allowed');
    expect(() => resolvePathWithin(baseDir, '../outside.txt')).toThrow('verlaesst den erlaubten Basisordner');
  });

  it('detects the current cli entrypoint for relative and absolute argv values', () => {
    const scriptPath = path.join(process.cwd(), 'scripts/ci/path-safety.ts');
    const importMetaUrl = new URL('./path-safety.ts', import.meta.url).toString();

    expect(isCliEntrypoint(importMetaUrl, scriptPath)).toBe(true);
    expect(isCliEntrypoint(importMetaUrl, path.relative(process.cwd(), scriptPath))).toBe(true);
    expect(isCliEntrypoint(importMetaUrl, 'scripts/ci/other.ts')).toBe(false);
    expect(isCliEntrypoint(importMetaUrl, undefined)).toBe(false);
  });
});
