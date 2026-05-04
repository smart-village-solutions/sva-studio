import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { validateProjectStatusReport } from './project-status';

const fixturePath = fileURLToPath(new URL('../data/project-status.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;

describe('project status report fixture', () => {
  it('matches the public schema contract', () => {
    expect(validateProjectStatusReport(fixture)).toEqual([]);
  });
});
