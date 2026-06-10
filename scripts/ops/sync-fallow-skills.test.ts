import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { syncFallowSkillSnapshot } from './sync-fallow-skills.ts';

describe('syncFallowSkillSnapshot', () => {
  it('copies the bundled fallow skill into the repo skill directory and removes stale files', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'fallow-skill-sync-'));
    const packageRoot = join(tempRoot, 'package-root');
    const repoRoot = join(tempRoot, 'repo-root');

    mkdirSync(join(packageRoot, 'node_modules', 'fallow', 'skills', 'fallow', 'references'), {
      recursive: true,
    });
    writeFileSync(
      join(packageRoot, 'node_modules', 'fallow', 'package.json'),
      JSON.stringify({ version: '2.91.0' }),
      'utf8',
    );
    writeFileSync(
      join(packageRoot, 'node_modules', 'fallow', 'skills', 'fallow', 'SKILL.md'),
      '# Fallow Skill\n',
      'utf8',
    );
    writeFileSync(
      join(
        packageRoot,
        'node_modules',
        'fallow',
        'skills',
        'fallow',
        'references',
        'cli-reference.md',
      ),
      'CLI reference\n',
      'utf8',
    );

    mkdirSync(join(repoRoot, '.agents', 'skills', 'fallow'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'fallow', 'stale.txt'), 'remove me', 'utf8');

    const result = syncFallowSkillSnapshot({
      packageRoot,
      repoRoot,
    });

    expect(result).toMatchObject({
      sourceVersion: '2.91.0',
      targetDir: join(repoRoot, '.agents', 'skills', 'fallow'),
    });
    expect(readFileSync(join(result.targetDir, 'SKILL.md'), 'utf8')).toContain('Fallow Skill');
    expect(
      readFileSync(join(result.targetDir, 'references', 'cli-reference.md'), 'utf8'),
    ).toContain('CLI reference');
    expect(() => readFileSync(join(result.targetDir, 'stale.txt'), 'utf8')).toThrow();

    const upstreamMetadata = JSON.parse(
      readFileSync(join(result.targetDir, '.upstream.json'), 'utf8'),
    ) as Record<string, unknown>;

    expect(upstreamMetadata).toMatchObject({
      packageName: 'fallow',
      sourceVersion: '2.91.0',
      sourceRelativePath: 'node_modules/fallow/skills/fallow',
    });
  });

  it('throws a helpful error when the bundled skill source is missing', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'fallow-skill-sync-missing-'));
    const packageRoot = join(tempRoot, 'package-root');
    const repoRoot = join(tempRoot, 'repo-root');

    mkdirSync(packageRoot, { recursive: true });
    mkdirSync(repoRoot, { recursive: true });

    expect(() =>
      syncFallowSkillSnapshot({
        packageRoot,
        repoRoot,
      }),
    ).toThrow('Bundled Fallow skill source not found');
  });
});
