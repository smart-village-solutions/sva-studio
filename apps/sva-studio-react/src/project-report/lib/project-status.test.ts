import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateProjectStatusReport } from './project-status';

const fixturePath = resolve(process.cwd(), 'apps/sva-studio-react/src/project-report/data/project-status.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;

describe('project status report fixture', () => {
  it('matches the public schema contract', () => {
    expect(validateProjectStatusReport(fixture)).toEqual([]);
  });
});
