// fallow-ignore-file code-duplication
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { syncImproveSkillSnapshot } from './sync-improve-skills.ts';

describe('syncImproveSkillSnapshot', () => {
  it('copies the improve skill into the repo skill directory and removes stale files', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'improve-skill-sync-'));
    const sourceRoot = join(tempRoot, 'source-root');
    const repoRoot = join(tempRoot, 'repo-root');

    mkdirSync(join(sourceRoot, 'references'), { recursive: true });
    writeFileSync(join(sourceRoot, 'SKILL.md'), '# Improve Skill\n', 'utf8');
    writeFileSync(
      join(sourceRoot, 'references', 'audit-playbook.md'),
      'Audit playbook\n',
      'utf8',
    );

    mkdirSync(join(repoRoot, '.agents', 'skills', 'improve'), { recursive: true });
    writeFileSync(join(repoRoot, '.agents', 'skills', 'improve', 'stale.txt'), 'remove me', 'utf8');

    const result = syncImproveSkillSnapshot({
      repoRoot,
      sourceDir: sourceRoot,
      sourceRevision: '03369ee6d7cafbfcecc4346539b05b3dc0a603bb',
    });

    expect(result).toMatchObject({
      sourceRevision: '03369ee6d7cafbfcecc4346539b05b3dc0a603bb',
      targetDir: join(repoRoot, '.agents', 'skills', 'improve'),
    });
    expect(readFileSync(join(result.targetDir, 'SKILL.md'), 'utf8')).toContain('Improve Skill');
    expect(readFileSync(join(result.targetDir, 'references', 'audit-playbook.md'), 'utf8')).toContain(
      'Audit playbook',
    );
    expect(() => readFileSync(join(result.targetDir, 'stale.txt'), 'utf8')).toThrow();

    const upstreamMetadata = JSON.parse(
      readFileSync(join(result.targetDir, '.upstream.json'), 'utf8'),
    ) as Record<string, unknown>;

    expect(upstreamMetadata).toMatchObject({
      repositoryUrl: 'https://github.com/shadcn/improve.git',
      sourceRevision: '03369ee6d7cafbfcecc4346539b05b3dc0a603bb',
      sourceRelativePath: 'skills/improve',
    });
  });

  it('throws a helpful error when the improve skill source is missing', () => {
    const tempRoot = mkdtempSync(resolve(tmpdir(), 'improve-skill-sync-missing-'));
    const repoRoot = join(tempRoot, 'repo-root');

    mkdirSync(repoRoot, { recursive: true });

    expect(() =>
      syncImproveSkillSnapshot({
        repoRoot,
        sourceDir: join(tempRoot, 'missing-source-root'),
        sourceRevision: '03369ee6d7cafbfcecc4346539b05b3dc0a603bb',
      }),
    ).toThrow('Bundled improve skill source not found');
  });
});
