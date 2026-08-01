import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(import.meta.dirname, '../../.github/workflows/database-restore.yml'),
  'utf8',
);

describe('database restore workflow', () => {
  it('identifies a successful staging drill by its stable workflow path, not its dynamic run name', () => {
    expect(workflow).toContain('.path == ".github/workflows/database-restore.yml"');
    expect(workflow).not.toContain('.name == "Controlled Database Restore"');
  });
});
